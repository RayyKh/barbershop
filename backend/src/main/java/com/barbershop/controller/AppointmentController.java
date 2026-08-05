package com.barbershop.controller;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.barbershop.dto.AppointmentRequest;
import com.barbershop.dto.RevenueReportDTO;
import com.barbershop.entity.Appointment;
import com.barbershop.entity.BlockedSlot;
import com.barbershop.entity.User;
import com.barbershop.repository.UserRepository;
import com.barbershop.service.AppointmentService;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {
    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(AppointmentController.class);
    private static final DateTimeFormatter BOOKING_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/uuuu");

    @Autowired
    private AppointmentService appointmentService;

    @Autowired
    private UserRepository userRepository;

    private final java.util.concurrent.CopyOnWriteArrayList<SseEmitter> emitters = new java.util.concurrent.CopyOnWriteArrayList<>();

    @PostMapping("/book")
    public Appointment bookAppointment(@jakarta.validation.Valid @RequestBody AppointmentRequest request) {
        // Logic to handle user:
        // 1. If authenticated, use that user.
        // 2. If not, check if user details provided match existing user (by email/phone)
        // 3. Create new user if needed.

        User user = null;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        boolean isLoggedAsAdmin = false;
        if (authentication != null && authentication.isAuthenticated() && !authentication.getPrincipal().equals("anonymousUser")) {
             String username = authentication.getName();
             user = userRepository.findByUsername(username).orElse(null);
             if (user != null && user.getRole() == User.Role.ADMIN) {
                 isLoggedAsAdmin = true;
             }
        }

        // If not logged in, or logged in as admin (who might be booking for someone else),
        // try to find or create a user based on the request details.
        if (user == null || isLoggedAsAdmin) {
            User guestUser = resolveOrCreateGuestUser(
                    request.getUserName(),
                    request.getUserFirstName(),
                    request.getUserPhone()
            );
            if (user == null || isLoggedAsAdmin) {
                user = guestUser;
            }
        }

        LocalDate bookingDate = parseBookingDate(request.getDate());
        Appointment appt = appointmentService.bookAppointment(user.getId(), request.getBarberId(), request.getServiceIds(), bookingDate, request.getStartTime(), isLoggedAsAdmin);
        notifyEmitters(appt);
        return appt;
    }

    private LocalDate parseBookingDate(String rawDate) {
        if (rawDate == null || rawDate.isBlank()) {
            throw new IllegalArgumentException("Date de réservation invalide");
        }
        String trimmed = rawDate.trim();
        try {
            if (trimmed.matches("\\d{2}/\\d{2}/\\d{4}")) {
                return LocalDate.parse(trimmed, BOOKING_DATE_FORMATTER);
            }
            throw new IllegalArgumentException("Format de date invalide (JJ/MM/AAAA): " + rawDate);
        } catch (DateTimeParseException | IndexOutOfBoundsException ex) {
            throw new IllegalArgumentException("Format de date invalide: " + rawDate, ex);
        }
    }

    private User resolveOrCreateGuestUser(String name, String firstName, String phone) {
        String normalizedPhone = normalizePhone(phone);
        if (normalizedPhone == null) {
            throw new IllegalArgumentException("Numéro de téléphone invalide");
        }

        User guestUser = userRepository.findByPhone(normalizedPhone)
                .orElseGet(() -> userRepository.findByUsername(normalizedPhone).orElse(null));

        if (guestUser == null) {
            try {
                User newUser = new User();
                newUser.setName(name != null ? name.trim() : null);
                newUser.setFirstName(firstName != null ? firstName.trim() : null);
                newUser.setPhone(normalizedPhone);
                newUser.setRole(User.Role.CLIENT);
                newUser.setUsername(normalizedPhone);
                guestUser = userRepository.save(newUser);
            } catch (Exception ex) {
                // Handle race/constraint conflicts by re-fetching existing row
                guestUser = userRepository.findByPhone(normalizedPhone)
                        .orElseGet(() -> userRepository.findByUsername(normalizedPhone)
                                .orElseThrow(() -> new RuntimeException(ex)));
            }
        }

        boolean dirty = false;
        if (guestUser.getPhone() == null || !guestUser.getPhone().equals(normalizedPhone)) {
            guestUser.setPhone(normalizedPhone);
            dirty = true;
        }
        if (guestUser.getUsername() == null || guestUser.getUsername().isBlank()) {
            guestUser.setUsername(normalizedPhone);
            dirty = true;
        }
        if ((guestUser.getName() == null || guestUser.getName().isBlank()) && name != null && !name.isBlank()) {
            guestUser.setName(name.trim());
            dirty = true;
        }
        if ((guestUser.getFirstName() == null || guestUser.getFirstName().isBlank()) && firstName != null && !firstName.isBlank()) {
            guestUser.setFirstName(firstName.trim());
            dirty = true;
        }
        if (guestUser.getRole() == null) {
            guestUser.setRole(User.Role.CLIENT);
            dirty = true;
        }
        return dirty ? userRepository.save(guestUser) : guestUser;
    }

    private String normalizePhone(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("\\D", "");
        return digits.isBlank() ? null : digits;
    }

    @GetMapping("/available")
    public List<LocalTime> getAvailableSlots(
            @RequestParam Long barberId, 
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        
        boolean isAdmin = false;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && !authentication.getPrincipal().equals("anonymousUser")) {
             String username = authentication.getName();
             User user = userRepository.findByUsername(username).orElse(null);
             if (user != null && user.getRole() == User.Role.ADMIN) {
                 isAdmin = true;
             }
        }

        return appointmentService.getAvailableSlots(barberId, date, isAdmin);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Appointment> getAllAppointments(
            @RequestParam(required = false) Long barberId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) com.barbershop.entity.AppointmentStatus status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "date,startTime") String sort
    ) {
        return filter(barberId, date, status, q, sort);
    }

    @GetMapping("/filter")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Appointment> filter(
            @RequestParam(required = false) Long barberId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) com.barbershop.entity.AppointmentStatus status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "date,startTime") String sort
    ) {
        List<Appointment> list = appointmentService.getAllAppointments();
        if (barberId != null) {
            list = list.stream().filter(a -> a.getBarber() != null && a.getBarber().getId().equals(barberId)).toList();
        }
        if (date != null) {
            list = list.stream().filter(a -> date.equals(a.getDate())).toList();
        }
        if (status != null) {
            list = list.stream().filter(a -> a.getStatus() == status).toList();
        }
        if (q != null && !q.isBlank()) {
            String qq = q.toLowerCase();
            list = list.stream().filter(a -> {
                String firstName = a.getUser() != null && a.getUser().getFirstName() != null ? a.getUser().getFirstName().toLowerCase() : "";
                String name = a.getUser() != null && a.getUser().getName() != null ? a.getUser().getName().toLowerCase() : "";
                String phone = a.getUser() != null && a.getUser().getPhone() != null ? a.getUser().getPhone().toLowerCase() : "";
                return firstName.contains(qq) || name.contains(qq) || phone.contains(qq);
            }).toList();
        }
        java.util.Comparator<Appointment> comparator = null;
        for (String col : sort.split(",")) {
            java.util.Comparator<Appointment> c = switch (col.trim()) {
                case "barber" -> java.util.Comparator.comparing(a -> a.getBarber() != null ? a.getBarber().getName() : "");
                case "date" -> java.util.Comparator.comparing(Appointment::getDate);
                case "startTime" -> java.util.Comparator.comparing(Appointment::getStartTime);
                case "status" -> java.util.Comparator.comparing(a -> a.getStatus().name());
                default -> null;
            };
            if (c != null) {
                comparator = comparator == null ? c : comparator.thenComparing(c);
            }
        }
        if (comparator != null) {
            list = list.stream().sorted(comparator).toList();
        }
        return list;
    }
    
    @GetMapping("/my-appointments")
    public List<Appointment> getMyAppointments() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username).orElseThrow();
        return appointmentService.getUserAppointments(user.getId());
    }

    @GetMapping("/by-contact")
    public List<Appointment> getByContact(
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone
    ) {
        if ((email == null || email.isBlank()) && (phone == null || phone.isBlank())) {
            return List.of();
        }
        return appointmentService.getAllAppointments().stream()
                .filter(a -> {
                    User u = a.getUser();
                    if (u == null) return false;
                    boolean matchEmail = email != null && !email.isBlank() && email.equalsIgnoreCase(u.getEmail());
                    boolean matchPhone = phone != null && !phone.isBlank() && phone.equalsIgnoreCase(u.getPhone());
                    return matchEmail || matchPhone;
                }).toList();
    }

    @PutMapping("/{id}/cancel")
    public Appointment cancelAppointment(@PathVariable Long id) {
        // In real app, check if user owns this appointment or is admin
        Appointment appt = appointmentService.cancelAppointment(id);
        notifyEmitters(appt);
        return appt;
    }

    @PutMapping("/{id}/modify")
    public Appointment modifyAppointment(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime startTime,
            @RequestParam(required = false) List<Long> serviceIds
    ) {
        Appointment appt = appointmentService.modifyAppointment(id, date, startTime, serviceIds);
        notifyEmitters(appt);
        return appt;
    }

    // Admin: lock a slot so it cannot be booked
    @PostMapping("/lock")
    @PreAuthorize("hasRole('ADMIN')")
    public Appointment lockSlot(
            @RequestParam Long barberId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime startTime,
            @RequestParam(required = false) String firstName,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false, name = "serviceIds") List<String> serviceIdsRaw
    ) {
        List<Long> serviceIds = parseServiceIds(serviceIdsRaw);
        Appointment appt = appointmentService.lockSlot(barberId, date, startTime, firstName, name, phone, serviceIds);
        notifyEmitters(appt);
        return appt;
    }

    @DeleteMapping("/lock")
    @PreAuthorize("hasRole('ADMIN')")
    public Appointment unlockSlot(
            @RequestParam Long barberId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime startTime
    ) {
        Appointment appt = appointmentService.unlockSlot(barberId, date, startTime);
        notifyEmitters(appt);
        return appt;
    }

    @PutMapping("/{id}/update")
    @PreAuthorize("hasRole('ADMIN')")
    public Appointment updateAppointment(
            @PathVariable Long id,
            @RequestParam Long barberId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime startTime,
            @RequestParam List<Long> serviceIds,
            @RequestParam(required = false) String clientName,
            @RequestParam(required = false) String clientPhone
    ) {
        Appointment appt = appointmentService.adminUpdateAppointment(id, barberId, date, startTime, serviceIds, clientName, clientPhone);
        notifyEmitters(appt);
        return appt;
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public Appointment updateStatus(@PathVariable Long id, @RequestParam com.barbershop.entity.AppointmentStatus status) {
        Appointment appt = appointmentService.updateStatus(id, status);
        notifyEmitters(appt);
        return appt;
    }

    @PutMapping("/{id}/view")
    @PreAuthorize("hasRole('ADMIN')")
    public Appointment markAdminViewed(@PathVariable Long id) {
        Appointment appt = appointmentService.markAdminViewed(id);
        notifyEmitters(appt);
        return appt;
    }

    @GetMapping("/new-count")
    @PreAuthorize("hasRole('ADMIN')")
    public long getNewBookedCount() {
        return appointmentService
                .getAllAppointments()
                .stream()
                .filter(a -> a.getStatus() == com.barbershop.entity.AppointmentStatus.BOOKED && !a.isAdminViewed())
                .count();
    }

    @GetMapping("/revenue-report/{barberId}")
    @PreAuthorize("hasRole('ADMIN')")
    public RevenueReportDTO getRevenueReport(
            @PathVariable Long barberId,
            @RequestParam(name = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        logger.info("Received revenue report request for barber {} with date {}", barberId, date);
        return appointmentService.getBarberRevenueReport(barberId, date);
    }

    // --- Blocked Slots Management ---

    @GetMapping("/blocked")
    @PreAuthorize("hasRole('ADMIN')")
    public List<BlockedSlot> getBlockedSlots() {
        return appointmentService.getAllBlockedSlots();
    }

    @PostMapping("/blocked")
    @PreAuthorize("hasRole('ADMIN')")
    public BlockedSlot blockSlot(
            @RequestParam String date,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(required = false) Long barberId,
            @RequestParam(required = false) String reason
    ) {
        return appointmentService.blockSlot(date, startTime, endTime, barberId, reason);
    }

    @DeleteMapping("/blocked/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteBlockedSlot(@PathVariable Long id) {
        appointmentService.deleteBlockedSlot(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteAppointment(@PathVariable Long id) {
        appointmentService.deleteAppointment(id);
        // We notify with a dummy appointment or just an event if needed
        // For simplicity, we can send a special event or just notify something changed
        Appointment dummy = new Appointment();
        dummy.setId(id);
        dummy.setStatus(com.barbershop.entity.AppointmentStatus.CANCELLED); // Or any status to trigger refresh
        notifyEmitters(dummy);
    }

    @CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        return emitter;
    }

    private void notifyEmitters(Appointment appt) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("appointment").data(appt));
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
    }

    private List<Long> parseServiceIds(List<String> rawValues) {
        if (rawValues == null || rawValues.isEmpty()) {
            return List.of();
        }

        List<Long> parsed = new ArrayList<>();
        for (String raw : rawValues) {
            if (raw == null || raw.isBlank()) continue;

            String[] chunks = raw.split(",");
            for (String chunk : chunks) {
                if (chunk == null || chunk.isBlank()) continue;
                String cleaned = chunk.trim().replaceAll("[^0-9]", "");
                if (cleaned.isBlank()) continue;
                try {
                    parsed.add(Long.parseLong(cleaned));
                } catch (NumberFormatException ignored) {
                    // Ignore malformed IDs instead of failing the entire request
                }
            }
        }
        return parsed;
    }
}
