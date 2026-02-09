package com.barbershop.service;

import com.barbershop.entity.*;
import com.barbershop.exception.ConflictException;
import com.barbershop.exception.ResourceNotFoundException;
import com.barbershop.repository.AppointmentRepository;
import com.barbershop.repository.BarberRepository;
import com.barbershop.repository.BlockedSlotRepository;
import com.barbershop.repository.ServiceRepository;
import com.barbershop.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import com.barbershop.dto.RevenueReportDTO;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

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

    private void checkConflicts(Long barberId, LocalDate date, LocalTime startTime, LocalTime endTime) {
        // 1. Check conflicts with other appointments
        List<Appointment> conflicts = appointmentRepository.findConflictingAppointments(barberId, date, startTime, endTime);
        if (!conflicts.isEmpty()) {
            throw new ConflictException("Slot not available (Conflict with appointment)");
        }

        // 2. Check conflicts with admin blockages
        List<BlockedSlot> blockages = blockedSlotRepository.findByDate(date);
        for (BlockedSlot b : blockages) {
            boolean barberMatches = (b.getBarber() == null || (barberId != null && b.getBarber().getId().equals(barberId)));
            if (barberMatches) {
                if (b.getStartTime() == null || b.getStartTime().isBlank()) {
                    throw new ConflictException("Date is blocked by administrator");
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
                        bEnd = bStart.plusMinutes(30);
                    }
                    
                    if (startTime.isBefore(bEnd) && endTime.isAfter(bStart)) {
                        throw new ConflictException("Slot is blocked by administrator");
                    }
                } catch (Exception e) {
                    logger.error("Error parsing blockage time: '{}' - '{}'", b.getStartTime(), b.getEndTime(), e);
                }
            }
        }
    }

    @Transactional
    public Appointment bookAppointment(Long userId, Long barberId, List<Long> serviceIds, LocalDate date, LocalTime startTime, boolean useReward) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Barber barber = barberRepository.findById(barberId)
                .orElseThrow(() -> new ResourceNotFoundException("Barber not found"));
        
        List<com.barbershop.entity.Service> selectedServices = serviceRepository.findAllById(serviceIds);
        if (selectedServices.isEmpty()) {
            throw new ResourceNotFoundException("No services selected");
        }

        LocalTime endTime = startTime.plusMinutes(30); 

        // Check for conflicts (appointments and admin blockages)
        checkConflicts(barberId, date, startTime, endTime);

        Appointment appointment = new Appointment();
        appointment.setUser(user);
        appointment.setBarber(barber);
        appointment.setServices(selectedServices);
        
        double total = selectedServices.stream().mapToDouble(s -> s.getPrice()).sum();
        
        // Loyalty Logic: Check if reward can be applied
        boolean rewardApplied = false;
        if (useReward && user.getAvailableRewards() > 0) {
            boolean hasCoupeBarbe = selectedServices.stream()
                .anyMatch(s -> s.getName().toLowerCase().contains("coupe") && s.getName().toLowerCase().contains("barbe"));
                
            if (hasCoupeBarbe) {
                // Find the price of "Coupe + Barbe" to subtract it (in case of multiple services)
                double coupeBarbePrice = selectedServices.stream()
                    .filter(s -> s.getName().toLowerCase().contains("coupe") && s.getName().toLowerCase().contains("barbe"))
                    .mapToDouble(com.barbershop.entity.Service::getPrice)
                    .findFirst()
                    .orElse(0.0);
                
                total -= coupeBarbePrice;
                if (total < 0) total = 0; // Should not happen
                
                rewardApplied = true;
                user.setAvailableRewards(user.getAvailableRewards() - 1);
                user.setUsedRewards(user.getUsedRewards() + 1);
                userRepository.save(user);
                logger.info("Reward applied for user {}. Service 'Coupe + Barbe' discounted. New total: {}", user.getName(), total);
            }
        }

        appointment.setTotalPrice(total);
        appointment.setRewardApplied(rewardApplied);
        
        appointment.setDate(date);
        appointment.setStartTime(startTime);
        appointment.setEndTime(endTime);
        appointment.setStatus(AppointmentStatus.BOOKED);
        appointment.setAdminViewed(false);

        Appointment saved = appointmentRepository.save(appointment);
        
        // Notification Push
        String servicesNames = selectedServices.stream()
            .map(com.barbershop.entity.Service::getName)
            .collect(java.util.stream.Collectors.joining(", "));

        pushNotificationService.sendNotificationToAdmins(
            "Nouveau Rendez-vous !",
            String.format("%s a réservé pour %s (Total: %.2f DT) avec %s le %s à %s", 
                user.getName(), servicesNames, total, barber.getName(), date, startTime)
        );

        return saved;
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

    public List<LocalTime> getAvailableSlots(Long barberId, LocalDate date) {
        LocalTime startOfDay;
        LocalTime endOfDay;

        if (date.getDayOfWeek() == DayOfWeek.MONDAY) {
            startOfDay = LocalTime.of(12, 0);
            endOfDay = LocalTime.of(18, 0);
        } else {
            startOfDay = LocalTime.of(10, 0);
            endOfDay = LocalTime.of(21, 0);
        }

        // Check if the whole day is blocked by admin
        List<BlockedSlot> dayBlockages = blockedSlotRepository.findByDate(date);
        logger.info("Checking availability for barber {} on {}. Found {} total blockages.", barberId, date, dayBlockages.size());

        boolean isWholeDayBlocked = dayBlockages.stream()
                .anyMatch(b -> {
                    boolean isNoTime = (b.getStartTime() == null || b.getStartTime().isBlank());
                    boolean barberMatches = (b.getBarber() == null || (barberId != null && b.getBarber().getId().equals(barberId)));
                    if (isNoTime && barberMatches) {
                        logger.info("Whole day is blocked for barber {} on {} (Blockage ID: {})", barberId, date, b.getId());
                        return true;
                    }
                    return false;
                });
        
        if (isWholeDayBlocked) {
            return new ArrayList<>();
        }

        List<LocalTime> allTimes = new ArrayList<>();
        LocalTime currentSlot = startOfDay;
        while (currentSlot.isBefore(endOfDay)) {
            allTimes.add(currentSlot);
            currentSlot = currentSlot.plusMinutes(30);
        }

        // Fetch booked appointments
        List<Appointment> bookedAppointments = appointmentRepository.findByBarber_IdAndDate(barberId, date);
        logger.info("Found {} existing appointments for barber {} on {}", bookedAppointments.size(), barberId, date);
        
        List<LocalTime> availableSlots = new ArrayList<>();
        for (LocalTime time : allTimes) {
            boolean isBooked = false;
            LocalTime slotEnd = time.plusMinutes(30);
            
            // 1. Check against appointments
            for (Appointment appt : bookedAppointments) {
                if (appt.getStatus() == AppointmentStatus.BOOKED || appt.getStatus() == AppointmentStatus.BLOCKED || appt.getStatus() == AppointmentStatus.MODIFIED) {
                     if (time.isBefore(appt.getEndTime()) && slotEnd.isAfter(appt.getStartTime())) {
                         isBooked = true;
                         break;
                     }
                 }
             }
            
            // 2. Check against specific slot blockages
            if (!isBooked) {
                final LocalTime t = time;
                final LocalTime tEnd = slotEnd;
                boolean isSlotBlocked = dayBlockages.stream()
                        .filter(b -> b.getStartTime() != null && !b.getStartTime().isBlank())
                        .anyMatch(b -> {
                            try {
                                String bStartStr = b.getStartTime().trim();
                                if (bStartStr.length() == 5) bStartStr += ":00"; // Ensure HH:mm:ss
                                LocalTime bStart = LocalTime.parse(bStartStr);
                                
                                LocalTime bEnd;
                                if (b.getEndTime() != null && !b.getEndTime().isBlank()) {
                                    String bEndStr = b.getEndTime().trim();
                                    if (bEndStr.length() == 5) bEndStr += ":00";
                                    bEnd = LocalTime.parse(bEndStr);
                                } else {
                                    bEnd = bStart.plusMinutes(30);
                                }
                                
                                boolean barberMatches = (b.getBarber() == null || (barberId != null && b.getBarber().getId().equals(barberId)));
                                boolean timeOverlaps = t.isBefore(bEnd) && tEnd.isAfter(bStart);
                                
                                if (barberMatches && timeOverlaps) {
                                    logger.info("Slot {}-{} is blocked by blockage {}-{} (ID: {}) for barber {}", t, tEnd, bStart, bEnd, b.getId(), barberId);
                                    return true;
                                }
                                return false;
                            } catch (Exception e) {
                                logger.error("Error parsing blockage time: '{}' - '{}'", b.getStartTime(), b.getEndTime(), e);
                                return false;
                            }
                        });
                if (isSlotBlocked) {
                    isBooked = true;
                }
            }

            if (!isBooked) {
                availableSlots.add(time);
            }
        }
        logger.info("Returning {} available slots for barber {} on {}", availableSlots.size(), barberId, date);
        return availableSlots;
    }

    @Transactional
    public List<BlockedSlot> getAllBlockedSlots() {
        return blockedSlotRepository.findAll();
    }

    @Transactional
    public BlockedSlot blockSlot(String dateStr, String startTime, String endTime, Long barberId, String reason) {
        LocalDate date = LocalDate.parse(dateStr);
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
    public Appointment modifyAppointment(Long appointmentId, LocalDate newDate, LocalTime newStartTime) {
        Appointment oldAppt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        
        // 1. Mark old appointment as CANCELLED (so it becomes available for others)
        oldAppt.setStatus(AppointmentStatus.CANCELLED);
        appointmentRepository.save(oldAppt);

        // 2. Create new appointment with same details but new date/time
        Appointment newAppt = new Appointment();
        newAppt.setUser(oldAppt.getUser());
        newAppt.setBarber(oldAppt.getBarber());
        newAppt.setServices(new ArrayList<>(oldAppt.getServices()));
        newAppt.setTotalPrice(oldAppt.getTotalPrice());
        newAppt.setRewardApplied(oldAppt.isRewardApplied());
        newAppt.setDate(newDate);
        newAppt.setStartTime(newStartTime);
        newAppt.setEndTime(newStartTime.plusMinutes(30));
        newAppt.setStatus(AppointmentStatus.MODIFIED); // Marked as MODIFIED
        newAppt.setAdminViewed(false);

        // Check for conflicts (appointments and admin blockages)
        checkConflicts(newAppt.getBarber().getId(), newAppt.getDate(), newAppt.getStartTime(), newAppt.getEndTime());

        Appointment saved = appointmentRepository.save(newAppt);

        // Notification Push pour modification
        String servicesNames = saved.getServices().stream()
            .map(com.barbershop.entity.Service::getName)
            .collect(java.util.stream.Collectors.joining(", "));

        pushNotificationService.sendNotificationToAdmins(
            "Rendez-vous Modifié",
            String.format("%s a modifié son rendez-vous pour %s. Nouvelle date: %s à %s", 
                saved.getUser().getName(), servicesNames, newDate, newStartTime)
        );

        return saved;
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
                
                // Check for reward (every 10 appointments)
                if (user.getTotalAppointments() % 10 == 0) {
                    user.setAvailableRewards(user.getAvailableRewards() + 1);
                    logger.info("User {} reached 10 appointments! Reward added. Total: {}, Available: {}", 
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
                
                // If the appointment that was cancelled was the 10th one, remove the reward
                if ((user.getTotalAppointments() + 1) % 10 == 0) {
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
    public Appointment lockSlot(Long barberId, LocalDate date, LocalTime startTime, String name, String phone) {
        Barber barber = barberRepository.findById(barberId)
                .orElseThrow(() -> new ResourceNotFoundException("Barber not found"));

        LocalTime endTime = startTime.plusMinutes(30);
        
        // Check for conflicts (appointments and admin blockages)
        checkConflicts(barberId, date, startTime, endTime);

        Appointment appointment = new Appointment();
        
        if (name != null && !name.isBlank() && phone != null && !phone.isBlank()) {
            User user = userRepository.findByPhone(phone).orElseGet(() -> {
                User newUser = new User();
                newUser.setName(name);
                newUser.setPhone(phone);
                newUser.setRole(User.Role.CLIENT);
                newUser.setUsername(phone);
                return userRepository.save(newUser);
            });
            appointment.setUser(user);
            appointment.setStatus(AppointmentStatus.BOOKED);
            appointment.setAdminViewed(false); // S'assurer que ça apparaît comme nouveau
        } else {
            appointment.setUser(null);
            appointment.setStatus(AppointmentStatus.BLOCKED);
            appointment.setAdminViewed(true); // Pas besoin de notification pour un blocage simple
        }

        appointment.setBarber(barber);
        appointment.setServices(new ArrayList<>());
        appointment.setTotalPrice(0.0);
        appointment.setDate(date);
        appointment.setStartTime(startTime);
        appointment.setEndTime(endTime);

        return appointmentRepository.save(appointment);
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
        
        // If it's a deletion of a booked/modified appointment with reward, refund it
        if (appointment.isRewardApplied() && appointment.getStatus() != AppointmentStatus.DONE) {
            User user = appointment.getUser();
            if (user != null) {
                user.setAvailableRewards(user.getAvailableRewards() + 1);
                user.setUsedRewards(Math.max(0, user.getUsedRewards() - 1));
                userRepository.save(user);
                logger.info("Reward refunded to user {} due to deletion of appointment {}", user.getName(), id);
            }
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
        detail.setClientName(a.getUser() != null ? a.getUser().getName() : "Guest");
        detail.setServices(a.getServices().stream().map(com.barbershop.entity.Service::getName).collect(Collectors.joining(", ")));
        detail.setPrice(a.getTotalPrice());
        detail.setDate(a.getDate().toString());
        return detail;
    }
}
