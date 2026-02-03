package com.barbershop.controller;

import com.barbershop.dto.AppointmentRequest;
import com.barbershop.entity.Appointment;
import com.barbershop.entity.User;
import com.barbershop.repository.UserRepository;
import com.barbershop.service.AppointmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    @Autowired
    private AppointmentService appointmentService;

    @Autowired
    private UserRepository userRepository;

    private final java.util.concurrent.CopyOnWriteArrayList<SseEmitter> emitters = new java.util.concurrent.CopyOnWriteArrayList<>();

    @PostMapping("/book")
    public Appointment bookAppointment(@RequestBody AppointmentRequest request) {
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
            User guestUser = null;
            
            // 1. Try to find by phone (most reliable for a barber shop)
            if (request.getUserPhone() != null && !request.getUserPhone().isBlank()) {
                guestUser = userRepository.findByPhone(request.getUserPhone()).orElse(null);
            }
            
            // 2. Try to find by email if phone didn't work
            if (guestUser == null && request.getUserEmail() != null && !request.getUserEmail().isBlank()) {
                guestUser = userRepository.findByEmail(request.getUserEmail()).orElse(null);
            }
            
            // 3. Create new if still not found
            if (guestUser == null) {
                guestUser = new User();
                guestUser.setName(request.getUserName());
                guestUser.setPhone(request.getUserPhone());
                guestUser.setEmail(request.getUserEmail());
                guestUser.setRole(User.Role.CLIENT);
                // Use phone as username for guests if email is missing
                guestUser.setUsername(request.getUserEmail() != null && !request.getUserEmail().isBlank() ? 
                                    request.getUserEmail() : request.getUserPhone());
                userRepository.save(guestUser);
            } else if (isLoggedAsAdmin) {
                // If admin found an existing user, we use that instead of the admin user
                user = guestUser;
            }
            
            if (user == null || isLoggedAsAdmin) {
                user = guestUser;
            }
        }

        Appointment appt = appointmentService.bookAppointment(user.getId(), request.getBarberId(), request.getServiceId(), request.getDate(), request.getStartTime());
        notifyEmitters(appt);
        return appt;
    }

    @GetMapping("/available")
    public List<LocalTime> getAvailableSlots(
            @RequestParam Long barberId, 
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return appointmentService.getAvailableSlots(barberId, date);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Appointment> getAllAppointments() {
        return appointmentService.getAllAppointments();
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
                String name = a.getUser() != null && a.getUser().getName() != null ? a.getUser().getName().toLowerCase() : "";
                String phone = a.getUser() != null && a.getUser().getPhone() != null ? a.getUser().getPhone().toLowerCase() : "";
                return name.contains(qq) || phone.contains(qq);
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

    // Admin: lock a slot so it cannot be booked
    @PostMapping("/lock")
    @PreAuthorize("hasRole('ADMIN')")
    public Appointment lockSlot(
            @RequestParam Long barberId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime startTime
    ) {
        Appointment appt = appointmentService.lockSlot(barberId, date, startTime);
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

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
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
}
