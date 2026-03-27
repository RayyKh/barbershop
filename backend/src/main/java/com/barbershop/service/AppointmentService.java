package com.barbershop.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.barbershop.dto.RevenueReportDTO;
import com.barbershop.entity.Appointment;
import com.barbershop.entity.AppointmentStatus;
import com.barbershop.entity.Barber;
import com.barbershop.entity.BlockedSlot;
import com.barbershop.entity.User;
import com.barbershop.exception.BadRequestException;
import com.barbershop.exception.ConflictException;
import com.barbershop.exception.ResourceNotFoundException;
import com.barbershop.repository.AppointmentRepository;
import com.barbershop.repository.BarberRepository;
import com.barbershop.repository.BlockedSlotRepository;
import com.barbershop.repository.ServiceRepository;
import com.barbershop.repository.UserRepository;

@Service
public class AppointmentService {
    private static final Logger logger = LoggerFactory.getLogger(AppointmentService.class);

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BarberRepository barberRepository;

    @Autowired
    private ServiceRepository serviceRepository;

    @Autowired
    private BlockedSlotRepository blockedSlotRepository;

    @Autowired
    private PushNotificationService pushNotificationService;

    private int toMinuteOfDay(LocalTime time) {
        return time.getHour() * 60 + time.getMinute();
    }

    private List<int[]> toSegments(LocalTime start, LocalTime end) {
        int startMin = toMinuteOfDay(start);
        int endMin = toMinuteOfDay(end);

        if (startMin == endMin) {
            return List.of();
        }

        if (endMin == 0 && startMin > 0) {
            return List.of(new int[] { startMin, 1440 });
        }

        if (endMin > startMin) {
            return List.of(new int[] { startMin, endMin });
        }

        return List.of(new int[] { startMin, 1440 }, new int[] { 0, endMin });
    }

    private boolean timesOverlap(LocalTime startA, LocalTime endA, LocalTime startB, LocalTime endB) {
        List<int[]> segmentsA = toSegments(startA, endA);
        List<int[]> segmentsB = toSegments(startB, endB);

        for (int[] a : segmentsA) {
            for (int[] b : segmentsB) {
                if (a[0] < b[1] && b[0] < a[1]) {
                    return true;
                }
            }
        }
        return false;
    }

    private void checkConflicts(Long barberId, LocalDate date, LocalTime startTime, LocalTime endTime, boolean skipRamadanCheck, boolean isAdmin) {
        // 1. Ramadan and Special Extensions Validation
        boolean isMarch2026 = date.getYear() == 2026 && date.getMonthValue() == 3;
        int dayOfMonth = date.getDayOfMonth();
        boolean isMarch21_2026 = isMarch2026 && dayOfMonth == 21;

        if (!skipRamadanCheck && (isRamadan(date) || isMarch21_2026)) {
            boolean validTime = false;

            // Check Morning Extension Window
            boolean isNightTo3ExtensionDate = isMarch2026 && (dayOfMonth == 18 || dayOfMonth == 19);
            boolean isNightTo6ExtensionDate = isMarch2026 && (dayOfMonth == 20 || dayOfMonth == 21);
            
            LocalTime endOfMorning = LocalTime.MIDNIGHT;
            if (isNightTo6ExtensionDate) endOfMorning = LocalTime.of(6, 15);
            else if (isNightTo3ExtensionDate) endOfMorning = LocalTime.of(3, 15);

            if (!startTime.isBefore(LocalTime.MIDNIGHT) && !startTime.isAfter(LocalTime.of(6, 0))) {
                if (isAdmin || (!startTime.isBefore(LocalTime.MIDNIGHT) && !endTime.isAfter(endOfMorning))) {
                    validTime = true;
                }
            }

            // Check Afternoon Window
            if (!validTime) {
                boolean isOpenFrom10 = isMarch2026 && dayOfMonth >= 17 && dayOfMonth <= 20;
                boolean isOpenFrom12 = isMarch2026 && dayOfMonth >= 11 && dayOfMonth <= 16;
                
                LocalTime firstWindowStart;
                if (isOpenFrom10 || isMarch21_2026) firstWindowStart = LocalTime.of(10, 0);
                else if (isOpenFrom12) firstWindowStart = LocalTime.of(12, 0);
                else firstWindowStart = LocalTime.of(12, 0);

                LocalTime firstWindowEnd;
                if (isMarch21_2026) firstWindowEnd = LocalTime.of(21, 0);
                else if (isAdmin) firstWindowEnd = LocalTime.of(18, 0);
                else firstWindowEnd = LocalTime.of(17, 0);

                if (!startTime.isBefore(firstWindowStart) && !endTime.isAfter(firstWindowEnd)) {
                    validTime = true;
                }
            }

            // Check Evening Window (Only for Ramadan days)
            if (!validTime && isRamadan(date) && !isMarch21_2026) {
                if (isAdmin) {
                    // Admin can book in the gap 18:00 - 19:45
                    if (!startTime.isBefore(LocalTime.of(18, 0)) && !startTime.isAfter(LocalTime.of(19, 45))) {
                        validTime = true;
                    }
                }

                if (!validTime && !startTime.isBefore(LocalTime.of(19, 45))) {
                    LocalTime endOfEvening;
                    boolean isSpecialDate = isMarch2026 && (dayOfMonth == 17 || dayOfMonth == 18 || dayOfMonth == 19);
                    boolean isMarch16 = isMarch2026 && dayOfMonth == 16;
                    boolean isLateEveningExtendedDate = isMarch2026 && dayOfMonth >= 17 && dayOfMonth <= 20;
                    boolean isLateEveningEarlyCloseDate = isMarch2026 && dayOfMonth >= 11 && dayOfMonth <= 16;

                    if (isAdmin || isSpecialDate || isLateEveningExtendedDate || isMarch16) {
                        validTime = !endTime.isBefore(startTime);
                    } else if (isLateEveningEarlyCloseDate) {
                        validTime = !endTime.isBefore(startTime) && !endTime.isAfter(LocalTime.of(21, 45));
                    } else {
                        validTime = !endTime.isAfter(LocalTime.of(22, 0)) && !endTime.equals(LocalTime.MIDNIGHT);
                    }
                }
            }

            if (!validTime) {
                throw new ConflictException("Pendant le Ramadan, les réservations ne sont pas autorisées à cette heure.");
            }
        }

        // 2. Check conflicts with other ACTIVE appointments
        // Fetch from previous day as well to catch appointments overlapping midnight
        List<Appointment> currentDayAppts = appointmentRepository.findActiveByBarberAndDate(barberId, date);
        List<Appointment> prevDayAppts = appointmentRepository.findActiveByBarberAndDate(barberId, date.minusDays(1));
        
        List<Appointment> existing = new ArrayList<>(currentDayAppts);
        existing.addAll(prevDayAppts);

        for (Appointment appt : existing) {
            LocalTime aStart = appt.getStartTime();
            LocalTime aEnd = appt.getEndTime();
            
            // Si le RDV est de la veille, il ne bloque que s'il finit APRÈS minuit (sur le jour actuel)
            if (appt.getDate().equals(date.minusDays(1))) {
                // Si end.isBefore(start), cela signifie qu'il a traversé minuit (ex: 23:45 -> 00:15)
                // SAUF si end == 00:00, auquel cas il s'arrête pile au début du jour actuel
                if (aEnd.equals(LocalTime.MIDNIGHT) || !aEnd.isBefore(aStart)) {
                    continue;
                }
                aStart = LocalTime.MIDNIGHT;
            }

            boolean overlap = timesOverlap(startTime, endTime, aStart, aEnd);

            if (overlap) {
                throw new ConflictException("Ce créneau n'est pas disponible car il contient déjà une réservation.");
            }
        }

        // 3. Check conflicts with admin blockages
        List<BlockedSlot> blockages = blockedSlotRepository.findByDate(date);
        for (BlockedSlot b : blockages) {
            boolean barberMatches = (b.getBarber() == null || (barberId != null && b.getBarber().getId().equals(barberId)));
            if (barberMatches) {
                if (b.getStartTime() == null || b.getStartTime().isBlank()) {
                    throw new ConflictException("Cette date est bloquée par l'administrateur.");
                }
                
                try {
                    String bStartStr = b.getStartTime().trim();
                    if (bStartStr.length() == 5) bStartStr += ":00";
                    LocalTime bStart = LocalTime.parse(bStartStr);
                    
                    LocalTime bEnd;
                    if (b.getEndTime() != null && !b.getEndTime().isBlank()) {
                        String bEndStr = b.getEndTime().trim();
                        if (bEndStr.length() == 5) bEndStr += ":00";
                        bEnd = LocalTime.parse(bEndStr);
                    } else {
                        bEnd = bStart.plusMinutes(15);
                    }
                    
                    boolean overlap = timesOverlap(startTime, endTime, bStart, bEnd);

                    if (overlap) {
                        throw new ConflictException("Ce créneau est bloqué par l'administrateur.");
                    }
                } catch (Exception e) {
                    logger.error("Error parsing blockage time: '{}'", b.getStartTime());
                }
            }
        }
    }

    @Transactional
    public synchronized Appointment bookAppointment(Long userId, Long barberId, List<Long> serviceIds, LocalDate date, LocalTime startTime, boolean useReward, boolean isBookedByAdmin) {
        // Force flush and check for conflicts again to ensure atomicity in concurrent requests
        // (Even with synchronized, double-check is safer if running in multiple instances or during high load)
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Barber barber = barberRepository.findById(barberId)
                .orElseThrow(() -> new ResourceNotFoundException("Barber not found"));
        if (barber.getName() != null && (barber.getName().equalsIgnoreCase("Ahmed") || barber.getName().equalsIgnoreCase("omar"))) {
            throw new BadRequestException("Ce barbier n'est plus disponible pour la réservation");
        }
        
        List<com.barbershop.entity.Service> selectedServices = serviceRepository.findAllById(serviceIds);
        if (selectedServices.isEmpty()) {
            throw new ResourceNotFoundException("No services selected");
        }

        // Calculate total duration based on all selected services
        int totalDuration = selectedServices.stream()
                .mapToInt(com.barbershop.entity.Service::getDuration)
                .sum();
        
        LocalTime endTime = startTime.plusMinutes(totalDuration); 

        // Check for conflicts (appointments and admin blockages)
        // Check if user is admin or booked by admin
        boolean isAdmin = isBookedByAdmin || (user != null && user.getRole() == User.Role.ADMIN);
        
        // RE-VERIFICATION STRICTE DES CONFLITS (Atomicité)
        checkConflicts(barberId, date, startTime, endTime, false, isAdmin);

        Appointment appointment = new Appointment();
        appointment.setUser(user);
        appointment.setBarber(barber);
        appointment.setServices(selectedServices);
        
        double total = selectedServices.stream().mapToDouble(com.barbershop.entity.Service::getPrice).sum();
        boolean rewardApplied = false;

        if (useReward) {
            if (user.getAvailableRewards() > 0) {
                // New Reward Logic: 50% off total + Free "Masque Noir"
                double newTotal = 0.0;
                
                for (com.barbershop.entity.Service s : selectedServices) {
                    if (s.getName().toLowerCase().contains("masque noir")) {
                        // Masque Noir is free
                        newTotal += 0.0;
                    } else {
                        // All other services are 50% off
                        newTotal += (s.getPrice() * 0.5);
                    }
                }
                
                total = newTotal;
                
                rewardApplied = true;
                user.setAvailableRewards(user.getAvailableRewards() - 1);
                user.setUsedRewards(user.getUsedRewards() + 1);
                userRepository.save(user);
                logger.info("Reward applied for user {}. 50% discount + Free Masque Noir. New total: {}", user.getName(), total);
            }
        }

        appointment.setTotalPrice(total);
        appointment.setRewardApplied(rewardApplied);
        
        appointment.setDate(date);
        appointment.setStartTime(startTime);
        appointment.setEndTime(endTime);
        appointment.setStatus(AppointmentStatus.BOOKED);
        appointment.setAdminViewed(false);

        // IMPORTANT: Flush any pending changes to ensure checkConflicts sees current state
        appointmentRepository.saveAndFlush(appointment);

        String servicesNames = appointment.getServices().stream()
            .map(com.barbershop.entity.Service::getName)
            .collect(java.util.stream.Collectors.joining(", "));

        String clientFullName = (user.getFirstName() != null && !user.getFirstName().isBlank()) 
            ? user.getFirstName() + " " + user.getName() 
            : user.getName();

        String title = "Nouveau Rendez-vous !";
        String message = String.format("%s a réservé pour %s (Total: %.2f DT) avec %s le %s à %s", 
            clientFullName, servicesNames, total, barber.getName(), date, startTime);

        // Envoyer la notification push ciblée pour ce barbier
        pushNotificationService.sendNotificationToBarber(barber.getId(), title, message);

        return appointment;
    }

    @Transactional
    public Appointment cancelAppointment(Long appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        
        // If reward was applied, refund it
        if (appointment.isRewardApplied()) {
            User user = appointment.getUser();
            if (user != null) {
                user.setAvailableRewards(user.getAvailableRewards() + 1);
                user.setUsedRewards(Math.max(0, user.getUsedRewards() - 1));
                userRepository.save(user);
                logger.info("Reward refunded to user {} due to cancellation of appointment {}", user.getName(), appointmentId);
            }
        }
        
        appointment.setStatus(AppointmentStatus.CANCELLED);
        return appointmentRepository.save(appointment);
    }

    public List<Appointment> getAllAppointments() {
        return appointmentRepository.findAll();
    }
    
    public List<Appointment> getUserAppointments(Long userId) {
        return appointmentRepository.findByUser_Id(userId);
    }

    private boolean isRamadan(LocalDate date) {
        int year = date.getYear();
        LocalDate start = LocalDate.of(year, 2, 19);
        LocalDate end = LocalDate.of(year, 3, 20);
        return !date.isBefore(start) && !date.isAfter(end);
    }

    public List<LocalTime> getAvailableSlots(Long barberId, LocalDate date, boolean isAdmin) {
        List<LocalTime> allTimes = new ArrayList<>();
        
        boolean isMarch2026 = date.getYear() == 2026 && date.getMonthValue() == 3;
        int dayOfMonth = date.getDayOfMonth();
        boolean isMarch21_2026 = isMarch2026 && dayOfMonth == 21;

        if (isRamadan(date) || isMarch21_2026) {
            // 1. Morning Extension Window (00:00 - 06:15)
            boolean isNightTo3ExtensionDate = isMarch2026 && (dayOfMonth == 18 || dayOfMonth == 19);
            boolean isNightTo6ExtensionDate = isMarch2026 && (dayOfMonth == 20 || dayOfMonth == 21);
            
            LocalTime tMorning = LocalTime.MIDNIGHT;
            LocalTime endOfMorning = LocalTime.MIDNIGHT;
            if (isNightTo6ExtensionDate) endOfMorning = LocalTime.of(6, 15);
            else if (isNightTo3ExtensionDate) endOfMorning = LocalTime.of(3, 15);
            
            while (tMorning.isBefore(endOfMorning)) {
                if (!allTimes.contains(tMorning)) {
                    allTimes.add(tMorning);
                }
                tMorning = tMorning.plusMinutes(15);
            }

            // 2. Afternoon Window
            boolean isOpenFrom10 = isMarch2026 && dayOfMonth >= 17 && dayOfMonth <= 20;
            boolean isOpenFrom12 = isMarch2026 && dayOfMonth >= 11 && dayOfMonth <= 16;
            
            LocalTime tAfternoon;
            if (isOpenFrom10 || isMarch21_2026) tAfternoon = LocalTime.of(10, 0);
            else if (isOpenFrom12) tAfternoon = LocalTime.of(12, 0);
            else tAfternoon = LocalTime.of(12, 0);

            LocalTime endOfFirstWindow;
            if (isMarch21_2026) endOfFirstWindow = LocalTime.of(21, 0);
            else if (isAdmin) endOfFirstWindow = LocalTime.of(18, 0);
            else endOfFirstWindow = LocalTime.of(17, 0);
            
            while (tAfternoon.isBefore(endOfFirstWindow)) {
                if (!allTimes.contains(tAfternoon)) allTimes.add(tAfternoon);
                tAfternoon = tAfternoon.plusMinutes(15);
            }

            // 3. Evening Window
            if (isRamadan(date) && !isMarch21_2026) {
                if (isAdmin) {
                    LocalTime tGap = LocalTime.of(18, 0);
                    while (tGap.isBefore(LocalTime.of(19, 45))) {
                        if (!allTimes.contains(tGap)) allTimes.add(tGap);
                        tGap = tGap.plusMinutes(15);
                    }
                }

                LocalTime tEvening = LocalTime.of(19, 45);
                LocalTime endOfEvening;
                boolean isSpecialDate = isMarch2026 && (dayOfMonth == 17 || dayOfMonth == 18 || dayOfMonth == 19);
                boolean isMarch16 = isMarch2026 && dayOfMonth == 16;
                boolean isLateEveningExtendedDate = isMarch2026 && dayOfMonth >= 17 && dayOfMonth <= 20;
                boolean isLateEveningEarlyCloseDate = isMarch2026 && dayOfMonth >= 11 && dayOfMonth <= 16;

                if (isAdmin || isSpecialDate || isLateEveningExtendedDate || isMarch16) {
                    endOfEvening = LocalTime.MAX;
                } else if (isLateEveningEarlyCloseDate) {
                    endOfEvening = LocalTime.of(21, 45);
                } else {
                    endOfEvening = LocalTime.of(22, 0);
                }
                
                while (tEvening.isBefore(endOfEvening) && !tEvening.equals(LocalTime.MIDNIGHT)) {
                    if (!allTimes.contains(tEvening)) allTimes.add(tEvening);
                    LocalTime next = tEvening.plusMinutes(15);
                    if (next.isBefore(tEvening) || next.equals(LocalTime.MIDNIGHT)) break;
                    tEvening = next;
                }
            }
            
            allTimes.sort(LocalTime::compareTo);
            return getAvailableSlotsFromList(barberId, date, allTimes, blockedSlotRepository, appointmentRepository);

        } else {
            LocalTime startOfDay;
            LocalTime endOfDay;

            if (date.getDayOfWeek() == DayOfWeek.MONDAY) {
                startOfDay = LocalTime.of(12, 0);
                endOfDay = LocalTime.of(18, 0);
            } else {
                Optional<Barber> barberOpt = barberRepository.findById(barberId);
                if (barberOpt.isPresent()) {
                    String name = barberOpt.get().getName().toLowerCase();
                    if (name.contains("hamouda")) startOfDay = LocalTime.of(12, 0);
                    else if (name.contains("ahmed")) startOfDay = LocalTime.of(11, 0);
                    else startOfDay = LocalTime.of(10, 0);
                } else {
                    startOfDay = LocalTime.of(10, 0);
                }
                endOfDay = LocalTime.of(21, 0);
            }

            LocalTime currentSlot = startOfDay;
            while (currentSlot.isBefore(endOfDay)) {
                allTimes.add(currentSlot);
                currentSlot = currentSlot.plusMinutes(15);
            }
            
            if (isAdmin) {
                LocalTime late = endOfDay;
                while (late.isBefore(LocalTime.MAX) && !late.equals(LocalTime.MIDNIGHT)) {
                     allTimes.add(late);
                     LocalTime next = late.plusMinutes(15);
                     if (next.isBefore(late) || next.equals(LocalTime.MIDNIGHT)) break;
                     late = next;
                }
                LocalTime morning = LocalTime.MIDNIGHT;
                while (morning.isBefore(LocalTime.of(3, 15))) {
                    allTimes.add(morning);
                    morning = morning.plusMinutes(15);
                }
            }
            allTimes.sort(LocalTime::compareTo);
            return getAvailableSlotsFromList(barberId, date, allTimes, blockedSlotRepository, appointmentRepository);
        }
    }

    private List<LocalTime> getAvailableSlotsFromList(Long barberId, LocalDate date, List<LocalTime> allTimes, BlockedSlotRepository blockedSlotRepository, AppointmentRepository appointmentRepository) {
        // 1. Check if the whole day is blocked by admin
        List<BlockedSlot> dayBlockages = blockedSlotRepository.findByDate(date);
        
        // 2. Fetch all appointments for this barber and date, then filter active ones in Java
        // Fetch from previous day as well to catch appointments overlapping midnight
        List<Appointment> currentDayAppts = appointmentRepository.findByBarber_IdAndDate(barberId, date);
        List<Appointment> prevDayAppts = appointmentRepository.findByBarber_IdAndDate(barberId, date.minusDays(1));
        
        List<Appointment> allAppts = new ArrayList<>(currentDayAppts);
        allAppts.addAll(prevDayAppts);

        List<Appointment> activeAppts = allAppts.stream()
                .filter(a -> {
                    AppointmentStatus s = a.getStatus();
                    // BOOKED, MODIFIED, BLOCKED, DONE all occupy a slot
                    return s == AppointmentStatus.BOOKED || 
                           s == AppointmentStatus.MODIFIED || 
                           s == AppointmentStatus.BLOCKED ||
                           s == AppointmentStatus.DONE;
                })
                .toList();

        logger.info("Barber {} on {}: found {} total and {} active appointments (including prev day)", barberId, date, allAppts.size(), activeAppts.size());

        List<LocalTime> availableSlots = new ArrayList<>();
        for (LocalTime time : allTimes) {
            LocalTime slotEnd = time.plusMinutes(15);
            
            // A slot is blocked if:
            // - The whole day is blocked (unless it's early morning extension window)
            // - There is an overlapping appointment
            // - There is an overlapping specific blockage
            
            boolean isBlocked = false;

            // Whole day blockage check
            boolean isMorningExtension = time.isBefore(LocalTime.of(7, 0));
            boolean isWholeDayBlocked = dayBlockages.stream()
                .anyMatch(b -> (b.getStartTime() == null || b.getStartTime().isBlank()) && 
                               (b.getBarber() == null || (barberId != null && b.getBarber().getId().equals(barberId))));
            
            if (isWholeDayBlocked && !isMorningExtension) {
                isBlocked = true;
            }

            // Check against appointments
            if (!isBlocked) {
                for (Appointment appt : activeAppts) {
                    LocalTime start = appt.getStartTime();
                    LocalTime end = appt.getEndTime();
                    
                    // Si le RDV est de la veille, il ne bloque que s'il finit APRÈS minuit (sur le jour actuel)
                    if (appt.getDate().equals(date.minusDays(1))) {
                        // Si end.isBefore(start), cela signifie qu'il a traversé minuit (ex: 23:45 -> 00:15)
                        if (!end.isBefore(start) && !end.equals(LocalTime.MIDNIGHT)) {
                            continue;
                        }
                        // Si c'est un RDV qui finit après minuit, pour aujourd'hui, il commence à 00:00
                        // et finit à 'end' (qui est l'heure sur le jour actuel)
                        start = LocalTime.MIDNIGHT;
                    }

                    boolean overlap = timesOverlap(time, slotEnd, start, end);

                    if (overlap) {
                        logger.info("Slot {} is blocked by appointment {}-{} (date: {}, status: {})", time, appt.getStartTime(), appt.getEndTime(), appt.getDate(), appt.getStatus());
                        isBlocked = true;
                        break;
                    }
                }
            }

            // Check against specific slot blockages
            if (!isBlocked) {
                for (BlockedSlot b : dayBlockages) {
                    if (b.getStartTime() == null || b.getStartTime().isBlank()) continue;
                    if (b.getBarber() != null && !b.getBarber().getId().equals(barberId)) continue;

                    try {
                        String bStartStr = b.getStartTime().trim();
                        if (bStartStr.length() == 5) bStartStr += ":00";
                        LocalTime bStart = LocalTime.parse(bStartStr);
                        
                        LocalTime bEnd;
                        if (b.getEndTime() != null && !b.getEndTime().isBlank()) {
                            String bEndStr = b.getEndTime().trim();
                            if (bEndStr.length() == 5) bEndStr += ":00";
                            bEnd = LocalTime.parse(bEndStr);
                        } else {
                            bEnd = bStart.plusMinutes(15);
                        }

                        boolean overlap = timesOverlap(time, slotEnd, bStart, bEnd);

                        if (overlap) {
                            logger.info("Slot {} is blocked by specific blockage {}-{}", time, bStart, bEnd);
                            isBlocked = true;
                            break;
                        }
                    } catch (Exception e) {
                        logger.error("Error parsing blockage time: {}", b.getStartTime());
                    }
                }
            }

            if (!isBlocked) {
                availableSlots.add(time);
            }
        }
        return availableSlots;
    }

    @Transactional
    public List<BlockedSlot> getAllBlockedSlots() {
        return blockedSlotRepository.findAll();
    }

    @Transactional
    public BlockedSlot blockSlot(String dateStr, String startTime, String endTime, Long barberId, String reason) {
        LocalDate date = LocalDate.parse(dateStr);
        
        // 1. Vérifier s'il y a déjà des réservations pour ce créneau ou cette journée
        List<Appointment> existingAppointments = appointmentRepository.findByDate(date);
        
        if (barberId != null) {
            existingAppointments = existingAppointments.stream()
                .filter(a -> a.getBarber() != null && a.getBarber().getId().equals(barberId))
                .toList();
        }

        if (startTime == null || startTime.isBlank()) {
            // Blocage de toute la journée
            boolean hasActiveAppointments = existingAppointments.stream()
                .anyMatch(a -> a.getStatus() == AppointmentStatus.BOOKED || a.getStatus() == AppointmentStatus.MODIFIED);
            if (hasActiveAppointments) {
                logger.warn("Admin bloque une journée qui contient déjà des réservations. Date: {}", date);
            }
        } else {
            // Blocage d'un créneau spécifique
            try {
                String sStartStr = startTime.trim();
                if (sStartStr.length() == 5) sStartStr += ":00";
                LocalTime bStart = LocalTime.parse(sStartStr);
                
                LocalTime bEnd;
                if (endTime != null && !endTime.isBlank()) {
                    String sEndStr = endTime.trim();
                    if (sEndStr.length() == 5) sEndStr += ":00";
                    bEnd = LocalTime.parse(sEndStr);
                } else {
                    bEnd = bStart.plusMinutes(30);
                }

                boolean hasActiveAppointments = existingAppointments.stream()
                    .filter(a -> a.getStatus() == AppointmentStatus.BOOKED || a.getStatus() == AppointmentStatus.MODIFIED)
                    .anyMatch(a -> {
                        LocalTime aStart = a.getStartTime();
                        LocalTime aEnd = a.getEndTime();
                        boolean aEndsAtMidnight = aEnd.equals(LocalTime.MIDNIGHT);
                        boolean bEndsAtMidnight = bEnd.equals(LocalTime.MIDNIGHT);

                        boolean overlap;
                        if (aEndsAtMidnight) {
                            overlap = bEndsAtMidnight || bEnd.isAfter(aStart);
                        } else if (bEndsAtMidnight) {
                            overlap = bStart.isBefore(aEnd);
                        } else {
                            overlap = bStart.isBefore(aEnd) && bEnd.isAfter(aStart);
                        }
                        return overlap;
                    });
                
                if (hasActiveAppointments) {
                    logger.warn("Admin bloque un créneau qui contient déjà une réservation. Date: {} Slot: {}-{}", date, bStart, bEnd);
                }
            } catch (Exception e) {
                if (e instanceof ConflictException) throw e;
                logger.error("Error parsing blockage time for validation: {} - {}", startTime, endTime, e);
            }
        }

        BlockedSlot bs = new BlockedSlot();
        bs.setDate(date);
        bs.setStartTime(startTime);
        bs.setEndTime(endTime);
        bs.setReason(reason);
        if (barberId != null) {
            bs.setBarber(barberRepository.findById(barberId).orElse(null));
        }
        return blockedSlotRepository.save(bs);
    }

    @Transactional
    public void deleteBlockedSlot(Long id) {
        blockedSlotRepository.deleteById(id);
    }

    @Transactional
    public synchronized Appointment modifyAppointment(Long appointmentId, LocalDate newDate, LocalTime newStartTime, List<Long> newServiceIds) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        
        // Règle spéciale de surclassement (Upgrade Rule)
        boolean isSpecialUpgrade = false;
        if (newServiceIds != null && !newServiceIds.isEmpty()) {
            List<String> oldNames = appt.getServices().stream().map(com.barbershop.entity.Service::getName).toList();
            List<com.barbershop.entity.Service> newServices = serviceRepository.findAllById(newServiceIds);
            List<String> newNames = newServices.stream().map(com.barbershop.entity.Service::getName).toList();

            boolean wasBasic = oldNames.size() == 1 && (
                oldNames.contains("Coupe") || 
                oldNames.contains("Barbe") || 
                oldNames.contains("Barbe (courte)")
            );
            boolean isPack = newNames.size() == 1 && newNames.contains("Coupe + Barbe Dégradé + Fixation");
            
            boolean wasPack = oldNames.size() == 1 && oldNames.contains("Coupe + Barbe Dégradé + Fixation");
            boolean isPackWithCire = newNames.size() == 2 && 
                                   newNames.contains("Coupe + Barbe Dégradé + Fixation") && 
                                   newNames.contains("Épilation à la cire");

            if ((wasBasic && isPack) || (wasPack && isPackWithCire)) {
                isSpecialUpgrade = true;
                logger.info("Special Upgrade Rule applied for appointment {}. Bypassing conflict checks for duration extension.", appointmentId);
            }
        }

        // Update basic fields
        appt.setDate(newDate);
        appt.setStartTime(newStartTime);
        
        // Update services if provided
        if (newServiceIds != null && !newServiceIds.isEmpty()) {
            List<com.barbershop.entity.Service> selectedServices = serviceRepository.findAllById(newServiceIds);
            if (!selectedServices.isEmpty()) {
                appt.setServices(selectedServices);
                
                // Recalculate price
                double total = selectedServices.stream().mapToDouble(com.barbershop.entity.Service::getPrice).sum();
                
                if (appt.isRewardApplied()) {
                     double newTotal = 0.0;
                     for (com.barbershop.entity.Service s : selectedServices) {
                        if (s.getName().toLowerCase().contains("masque noir")) {
                            // Masque Noir is free
                        } else {
                            newTotal += (s.getPrice() * 0.5);
                        }
                    }
                    total = newTotal;
                }
                appt.setTotalPrice(total);
            }
        }

        // Calculate required duration
        int requiredDuration = appt.getServices().stream().mapToInt(com.barbershop.entity.Service::getDuration).sum();
        if (requiredDuration == 0) requiredDuration = 30; // Default

        // Best Effort Duration Adjustment
        LocalTime validEndTime = newStartTime;
        LocalTime proposedEndTime = newStartTime.plusMinutes(requiredDuration);
        
        if (isSpecialUpgrade) {
            // Force the proposed end time regardless of conflicts
            validEndTime = proposedEndTime;
        } else {
            // Iterate in 15 min slots
            LocalTime checkTime = newStartTime;
            while (checkTime.isBefore(proposedEndTime)) {
                LocalTime nextSlot = checkTime.plusMinutes(15);
                
                if (isSlotAvailable(appt.getBarber().getId(), newDate, checkTime, nextSlot, appointmentId)) {
                    validEndTime = nextSlot;
                    checkTime = nextSlot;
                } else {
                    break;
                }
            }
            
            if (validEndTime.equals(newStartTime)) {
                 throw new ConflictException("Le créneau sélectionné n'est pas disponible.");
            }
        }

        appt.setEndTime(validEndTime);
        appt.setStatus(AppointmentStatus.MODIFIED);
        appt.setAdminViewed(false);

        Appointment saved = appointmentRepository.saveAndFlush(appt);

        // Notification Push pour modification
        String servicesNames = saved.getServices().stream()
            .map(com.barbershop.entity.Service::getName)
            .collect(java.util.stream.Collectors.joining(", "));

        String title = "Rendez-vous Modifié";
        String message = String.format("%s a modifié son rendez-vous pour %s. Nouvelle date: %s à %s", 
            saved.getUser().getName(), servicesNames, newDate, newStartTime);

        if (saved.getBarber() != null) {
            pushNotificationService.sendNotificationToBarber(saved.getBarber().getId(), title, message);
        } else {
            pushNotificationService.sendNotificationToAdmins(title, message);
        }

        return saved;
    }

    private boolean isSlotAvailable(Long barberId, LocalDate date, LocalTime startTime, LocalTime endTime, Long excludeAppointmentId) {
        // 1. Check Ramadan
        boolean isMarch2026 = date.getYear() == 2026 && date.getMonthValue() == 3;
        boolean isMarch21_2026 = isMarch2026 && date.getDayOfMonth() == 21;

        if (isRamadan(date) || (isMarch21_2026 && startTime.isBefore(LocalTime.of(6, 15)))) {
            boolean isOpenFrom10 = isMarch2026 && date.getDayOfMonth() >= 17 && date.getDayOfMonth() <= 20;
            boolean isOpenFrom12 = isMarch2026 && date.getDayOfMonth() >= 11 && date.getDayOfMonth() <= 16;
            boolean isLateEveningExtendedDate = isMarch2026 && date.getDayOfMonth() >= 17 && date.getDayOfMonth() <= 20;
            boolean isLateEveningEarlyCloseDate = isMarch2026 && date.getDayOfMonth() >= 11 && date.getDayOfMonth() <= 16;
            boolean isNightTo3ExtensionDate = isMarch2026 && date.getDayOfMonth() >= 18 && date.getDayOfMonth() <= 19;
            boolean isNightTo6ExtensionDate = isMarch2026 && (date.getDayOfMonth() == 20 || date.getDayOfMonth() == 21);

            LocalTime firstWindowStart = isOpenFrom10 ? LocalTime.of(10, 0) : (isOpenFrom12 ? LocalTime.of(12, 0) : LocalTime.of(12, 0));
            boolean inFirstWindow = !startTime.isBefore(firstWindowStart) && !endTime.isAfter(LocalTime.of(17, 0));
            
            boolean inSecondWindow = false;
            if (!startTime.isBefore(LocalTime.of(19, 45))) {
                if (isLateEveningExtendedDate) {
                    inSecondWindow = !endTime.isBefore(startTime);
                } else if (isLateEveningEarlyCloseDate) {
                    inSecondWindow = !endTime.isBefore(startTime) && !endTime.isAfter(LocalTime.of(21, 45));
                } else {
                    inSecondWindow = !endTime.isAfter(LocalTime.of(22, 0)) && !endTime.equals(LocalTime.MIDNIGHT);
                }
            }
            
            boolean inThirdWindow = false;
            if (!startTime.isBefore(LocalTime.MIDNIGHT) && !startTime.isAfter(LocalTime.of(6, 0))) {
                if (isNightTo3ExtensionDate) {
                    inThirdWindow = !endTime.isBefore(startTime) && !endTime.isAfter(LocalTime.of(3, 15));
                } else if (isNightTo6ExtensionDate) {
                    inThirdWindow = !endTime.isBefore(startTime) && !endTime.isAfter(LocalTime.of(6, 15));
                }
            }

            if (!inFirstWindow && !inSecondWindow && !inThirdWindow) {
                return false;
            }
        }

        // 2. Check conflicts with other appointments
        // Fetch from current and previous day to handle midnight overlaps
        List<Appointment> currentDayAppts = appointmentRepository.findActiveByBarberAndDate(barberId, date);
        List<Appointment> prevDayAppts = appointmentRepository.findActiveByBarberAndDate(barberId, date.minusDays(1));
        
        List<Appointment> existing = new ArrayList<>(currentDayAppts);
        existing.addAll(prevDayAppts);

        boolean hasConflict = existing.stream().anyMatch(a -> {
            if (a.getId().equals(excludeAppointmentId)) return false;
            
            LocalTime aStart = a.getStartTime();
            LocalTime aEnd = a.getEndTime();
            
            // Si le RDV est de la veille, il ne bloque que s'il finit APRÈS minuit (sur le jour actuel)
            if (a.getDate().equals(date.minusDays(1))) {
                if (aEnd.equals(LocalTime.MIDNIGHT) || !aEnd.isBefore(aStart)) {
                    return false;
                }
                aStart = LocalTime.MIDNIGHT;
            }

            return timesOverlap(startTime, endTime, aStart, aEnd);
        });
        
        if (hasConflict) {
            return false;
        }

        // 3. Check conflicts with admin blockages
        List<BlockedSlot> blockages = blockedSlotRepository.findByDate(date);
        for (BlockedSlot b : blockages) {
            boolean barberMatches = (b.getBarber() == null || (barberId != null && b.getBarber().getId().equals(barberId)));
            if (barberMatches) {
                if (b.getStartTime() == null || b.getStartTime().isBlank()) {
                    return false; 
                }
                try {
                    String bStartStr = b.getStartTime().trim();
                    if (bStartStr.length() == 5) bStartStr += ":00";
                    LocalTime bStart = LocalTime.parse(bStartStr);
                    
                    LocalTime bEnd;
                    if (b.getEndTime() != null && !b.getEndTime().isBlank()) {
                        String bEndStr = b.getEndTime().trim();
                        if (bEndStr.length() == 5) bEndStr += ":00";
                        bEnd = LocalTime.parse(bEndStr);
                    } else {
                        bEnd = bStart.plusMinutes(15);
                    }
                    
                    if (timesOverlap(startTime, endTime, bStart, bEnd)) {
                        return false;
                    }
                } catch (Exception e) {
                    logger.error("Error parsing blockage time: '{}' - '{}'", b.getStartTime(), b.getEndTime(), e);
                }
            }
        }
        
        return true;
    }

    @Transactional
    public Appointment adminUpdateAppointment(Long id, Long barberId, LocalDate date, LocalTime startTime, List<Long> serviceIds, String clientName, String clientPhone) {
        Appointment appt = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

        Barber barber = barberRepository.findById(barberId)
                .orElseThrow(() -> new ResourceNotFoundException("Barber not found"));
        if (barber.getName() != null && (barber.getName().equalsIgnoreCase("Ahmed") || barber.getName().equalsIgnoreCase("omar"))) {
            throw new BadRequestException("Ce barbier n'est plus disponible");
        }

        // Update Client Name if provided
        if (clientName != null && !clientName.isBlank()) {
            User user = appt.getUser();
            if (user != null) {
                user.setName(clientName);
                userRepository.save(user);
            }
        }

        // Update Client Phone if provided
        if (clientPhone != null && !clientPhone.isBlank()) {
            User user = appt.getUser();
            if (user != null) {
                // Check if phone number is actually different to avoid unnecessary updates
                if (!clientPhone.equals(user.getPhone())) {
                    // Also check if the new phone number is already taken by another user
                    Optional<User> existingUserWithNewPhone = userRepository.findByPhone(clientPhone);
                    if (existingUserWithNewPhone.isPresent() && !existingUserWithNewPhone.get().getId().equals(user.getId())) {
                        throw new ConflictException("Le numéro de téléphone " + clientPhone + " est déjà utilisé par un autre client.");
                    }
                    user.setPhone(clientPhone);
                    // If username is based on phone, update it too
                    if (user.getUsername().equals(appt.getUser().getPhone())) {
                        user.setUsername(clientPhone);
                    }
                    userRepository.save(user);
                }
            }
        }

        List<com.barbershop.entity.Service> selectedServices = serviceRepository.findAllById(serviceIds);
        if (selectedServices.isEmpty()) {
            throw new BadRequestException("At least one service must be selected");
        }

        // Règle spéciale de surclassement (Upgrade Rule)
        boolean isSpecialUpgrade = false;
        List<String> oldNames = appt.getServices().stream().map(com.barbershop.entity.Service::getName).toList();
        List<String> newNames = selectedServices.stream().map(com.barbershop.entity.Service::getName).toList();

        boolean wasBasic = oldNames.size() == 1 && (
            oldNames.contains("Coupe") || 
            oldNames.contains("Barbe") || 
            oldNames.contains("Barbe (courte)")
        );
        boolean isPack = newNames.size() == 1 && newNames.contains("Coupe + Barbe Dégradé + Fixation");
        
        boolean wasPack = oldNames.size() == 1 && oldNames.contains("Coupe + Barbe Dégradé + Fixation");
        boolean isPackWithCire = newNames.size() == 2 && 
                               newNames.contains("Coupe + Barbe Dégradé + Fixation") && 
                               newNames.contains("Épilation à la cire");

        if ((wasBasic && isPack) || (wasPack && isPackWithCire)) {
            isSpecialUpgrade = true;
            logger.info("Special Upgrade Rule applied for adminUpdateAppointment {}. Bypassing conflict checks.", id);
        }

        int totalDuration = selectedServices.stream().mapToInt(com.barbershop.entity.Service::getDuration).sum();
        LocalTime endTime = startTime.plusMinutes(totalDuration);

        // Temp change to avoid self-conflict
        AppointmentStatus originalStatus = appt.getStatus();
        
        // IMPORTANT: We must save the cancelled status to the DB so checkConflicts() sees it as cancelled
        // If we just set it in memory, checkConflicts will still see the old status in the DB query
        appt.setStatus(AppointmentStatus.CANCELLED);
        appointmentRepository.saveAndFlush(appt); // Force flush to ensure DB is updated before checkConflicts

        boolean skipRamadanCheck = false;
        // If date and start time are unchanged, skip Ramadan check (allow changing service/price/client)
        if (appt.getDate().equals(date) && appt.getStartTime().equals(startTime)) {
            skipRamadanCheck = true;
        }

        try {
            if (!isSpecialUpgrade) {
                checkConflicts(barberId, date, startTime, endTime, skipRamadanCheck, true); 
            }
        } catch (Exception e) {
            appt.setStatus(originalStatus);
            appointmentRepository.save(appt);
            throw e;
        }

        double total = selectedServices.stream().mapToDouble(com.barbershop.entity.Service::getPrice).sum();

        appt.setBarber(barber);
        appt.setDate(date);
        appt.setStartTime(startTime);
        appt.setEndTime(endTime);
        appt.setServices(selectedServices);
        appt.setTotalPrice(total);
        // Restore original status unless it was already CANCELLED
        appt.setStatus(originalStatus == AppointmentStatus.CANCELLED ? AppointmentStatus.BOOKED : originalStatus);
        appt.setAdminViewed(true);

        return appointmentRepository.save(appt);
    }

    @Transactional
    public Appointment updateStatus(Long appointmentId, AppointmentStatus status) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        
        AppointmentStatus oldStatus = appointment.getStatus();
        appointment.setStatus(status);
        
        // Loyalty Logic: When status changes to DONE
        if (status == AppointmentStatus.DONE && oldStatus != AppointmentStatus.DONE) {
            User user = appointment.getUser();
            if (user != null) {
                user.setTotalAppointments(user.getTotalAppointments() + 1);
                
                // Check for reward (every 5 appointments)
                if (user.getTotalAppointments() % 5 == 0) {
                    user.setAvailableRewards(user.getAvailableRewards() + 1);
                    logger.info("User {} reached 5 appointments! Reward added. Total: {}, Available: {}", 
                        user.getName(), user.getTotalAppointments(), user.getAvailableRewards());
                }
                userRepository.save(user);
            }
        }
        
        // Loyalty Logic: If status changes to CANCELLED, refund reward if applied
        if (status == AppointmentStatus.CANCELLED && oldStatus != AppointmentStatus.CANCELLED) {
            if (appointment.isRewardApplied()) {
                User user = appointment.getUser();
                if (user != null) {
                    user.setAvailableRewards(user.getAvailableRewards() + 1);
                    user.setUsedRewards(Math.max(0, user.getUsedRewards() - 1));
                    userRepository.save(user);
                    logger.info("Reward refunded to user {} due to status change to CANCELLED for appointment {}", user.getName(), appointmentId);
                }
            }
        }
        
        // Loyalty Logic: If status was DONE and changes to something else (cancellation after done, though rare)
        if (oldStatus == AppointmentStatus.DONE && status != AppointmentStatus.DONE) {
            User user = appointment.getUser();
            if (user != null) {
                user.setTotalAppointments(Math.max(0, user.getTotalAppointments() - 1));
                
                // If the appointment that was cancelled was the 5th one, remove the reward
                if ((user.getTotalAppointments() + 1) % 5 == 0) {
                    user.setAvailableRewards(Math.max(0, user.getAvailableRewards() - 1));
                }
                userRepository.save(user);
            }
        }

        return appointmentRepository.save(appointment);
    }

    @Transactional
    public Appointment markAdminViewed(Long appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        appointment.setAdminViewed(true);
        return appointmentRepository.save(appointment);
    }

    @Transactional
    public synchronized Appointment lockSlot(Long barberId, LocalDate date, LocalTime startTime, String firstName, String name, String phone, List<Long> serviceIds) {
        Barber barber = barberRepository.findById(barberId)
                .orElseThrow(() -> new ResourceNotFoundException("Barber not found"));

        List<com.barbershop.entity.Service> services = new ArrayList<>();
        double totalPrice = 0.0;
        int totalDuration = 30; // Default duration

        if (serviceIds != null && !serviceIds.isEmpty()) {
            for (Long sid : serviceIds) {
                serviceRepository.findById(sid).ifPresent(s -> {
                    services.add(s);
                });
            }
            totalPrice = services.stream().mapToDouble(com.barbershop.entity.Service::getPrice).sum();
            int durationSum = services.stream().mapToInt(com.barbershop.entity.Service::getDuration).sum();
            if (durationSum > 0) {
                totalDuration = durationSum;
            }
        }

        LocalTime endTime = startTime.plusMinutes(totalDuration);
        
        // Check for conflicts (appointments and admin blockages)
        checkConflicts(barberId, date, startTime, endTime, false, true); // No force for lock slot yet, assumed admin

        Appointment appointment = new Appointment();
        
        if (name != null && !name.isBlank() && phone != null && !phone.isBlank()) {
            User user = userRepository.findByPhone(phone).orElseGet(() -> {
                User newUser = new User();
                newUser.setFirstName(firstName);
                newUser.setName(name);
                newUser.setPhone(phone);
                newUser.setRole(User.Role.CLIENT);
                newUser.setUsername(phone);
                return userRepository.save(newUser);
            });
            appointment.setUser(user);
            appointment.setStatus(AppointmentStatus.BOOKED); // Initialement BOOKED pour permettre de marquer DONE plus tard
            appointment.setAdminViewed(false); // Afficher comme NEW pour l'admin
        } else {
            appointment.setUser(null);
            appointment.setStatus(AppointmentStatus.BLOCKED);
            appointment.setAdminViewed(true); // Pas besoin de notification pour un blocage simple
        }

        appointment.setBarber(barber);
        
        appointment.setServices(services);
        appointment.setTotalPrice(totalPrice);
        appointment.setDate(date);
        appointment.setStartTime(startTime);
        appointment.setEndTime(endTime);

        return appointmentRepository.saveAndFlush(appointment);
    }

    @Transactional
    public Appointment unlockSlot(Long barberId, LocalDate date, LocalTime startTime) {
        Appointment blocked = appointmentRepository.findBlockedSlot(barberId, date, startTime)
                .orElseThrow(() -> new ResourceNotFoundException("Blocked slot not found"));
        appointmentRepository.delete(blocked);
        return blocked;
    }

    @Transactional
    public void deleteAppointment(Long id) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        
        // Handle Loyalty Logic for Deletion
        User user = appointment.getUser();
        if (user != null) {
            // 1. Always refund reward if it was applied (regardless of status, if we delete it, we revert the usage)
            if (appointment.isRewardApplied()) {
                user.setAvailableRewards(user.getAvailableRewards() + 1);
                user.setUsedRewards(Math.max(0, user.getUsedRewards() - 1));
                logger.info("Reward refunded to user {} due to deletion of appointment {}", user.getName(), id);
            }
            
            // 2. If appointment was DONE, revert the loyalty point and any reward triggered by it
            if (appointment.getStatus() == AppointmentStatus.DONE) {
                user.setTotalAppointments(Math.max(0, user.getTotalAppointments() - 1));
                
                // If the removed appointment was a milestone (e.g. 5th, 10th), remove the earned reward
                // We just decremented, so we check if (newTotal + 1) % 5 == 0
                if ((user.getTotalAppointments() + 1) % 5 == 0) {
                    user.setAvailableRewards(Math.max(0, user.getAvailableRewards() - 1));
                    logger.info("Loyalty reward removed from user {} due to deletion of DONE appointment {}", user.getName(), id);
                }
            }
            userRepository.save(user);
        }
        
        appointmentRepository.deleteById(id);
    }

    public RevenueReportDTO getBarberRevenueReport(Long barberId, LocalDate targetDate) {
        logger.info("Generating revenue report for barber {} on date {}", barberId, targetDate);
        
        Barber barber = barberRepository.findById(barberId)
                .orElseThrow(() -> new ResourceNotFoundException("Barber not found"));

        // Use targetDate if provided, otherwise default to today
        LocalDate referenceDate = (targetDate != null) ? targetDate : LocalDate.now();
        
        // Force Monday as start of week
        LocalDate startOfWeek = referenceDate.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        LocalDate endOfWeek = startOfWeek.plusDays(6);

        logger.info("Report request: barberId={}, targetDate={}, calculated range=[{} to {}]", 
                barberId, targetDate, startOfWeek, endOfWeek);

        List<Appointment> doneAppointments = appointmentRepository.findByBarber_IdAndStatusAndDateBetween(
                barberId, AppointmentStatus.DONE, startOfWeek, endOfWeek)
                .stream()
                .sorted(java.util.Comparator.comparing(Appointment::getDate).thenComparing(Appointment::getStartTime))
                .collect(Collectors.toList());

        logger.info("Found {} done appointments for period {} to {}", doneAppointments.size(), startOfWeek, endOfWeek);

        RevenueReportDTO report = new RevenueReportDTO();
        report.setBarberId(barberId);
        report.setBarberName(barber.getName());

        // Group by Day (for the current week view)
        Map<LocalDate, List<Appointment>> byDate = doneAppointments.stream()
                .collect(Collectors.groupingBy(Appointment::getDate, TreeMap::new, Collectors.toList()));

        List<RevenueReportDTO.DailyRevenueDTO> dailyList = new ArrayList<>();
        // Even if empty, we want the DTO to reflect the week range
        byDate.forEach((date, appts) -> {
            RevenueReportDTO.DailyRevenueDTO daily = new RevenueReportDTO.DailyRevenueDTO();
            daily.setDate(date.toString());
            List<RevenueReportDTO.RevenueDetailDTO> details = appts.stream().map(this::mapToDetail).collect(Collectors.toList());
            daily.setDetails(details);
            daily.setTotalRevenue(appts.stream().mapToDouble(Appointment::getTotalPrice).sum());
            dailyList.add(daily);
        });
        report.setDailyRevenues(dailyList);

        // Group by Week
        List<RevenueReportDTO.WeeklyRevenueDTO> weeklyList = new ArrayList<>();
        
        if (!doneAppointments.isEmpty()) {
            WeekFields weekFields = WeekFields.of(Locale.FRANCE);
            RevenueReportDTO.WeeklyRevenueDTO weekly = new RevenueReportDTO.WeeklyRevenueDTO();
            weekly.setYear(startOfWeek.getYear());
            weekly.setWeekNumber(startOfWeek.get(weekFields.weekOfWeekBasedYear()));
            
            // Format range nicely: "09 Mar - 15 Mar"
            String range = String.format("%02d %s - %02d %s", 
                    startOfWeek.getDayOfMonth(), 
                    startOfWeek.getMonth().name().substring(0, 3).toLowerCase(),
                    endOfWeek.getDayOfMonth(), 
                    endOfWeek.getMonth().name().substring(0, 3).toLowerCase());
            weekly.setWeekRange(range);

            List<RevenueReportDTO.RevenueDetailDTO> details = doneAppointments.stream().map(this::mapToDetail).collect(Collectors.toList());
            weekly.setDetails(details);
            weekly.setTotalRevenue(doneAppointments.stream().mapToDouble(Appointment::getTotalPrice).sum());
            weeklyList.add(weekly);
        }
        
        report.setWeeklyRevenues(weeklyList);

        return report;
    }

    private RevenueReportDTO.RevenueDetailDTO mapToDetail(Appointment a) {
        RevenueReportDTO.RevenueDetailDTO detail = new RevenueReportDTO.RevenueDetailDTO();
        detail.setAppointmentId(a.getId());
        String firstName = (a.getUser() != null && a.getUser().getFirstName() != null) ? a.getUser().getFirstName() : "";
        String name = (a.getUser() != null && a.getUser().getName() != null) ? a.getUser().getName() : "Guest";
        detail.setClientName((firstName + " " + name).trim());
        detail.setServices(a.getServices().stream().map(com.barbershop.entity.Service::getName).collect(Collectors.joining(", ")));
        detail.setPrice(a.getTotalPrice());
        detail.setDate(a.getDate().toString());
        return detail;
    }
}
