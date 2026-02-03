package com.barbershop.service;

import com.barbershop.entity.*;
import com.barbershop.exception.ConflictException;
import com.barbershop.exception.ResourceNotFoundException;
import com.barbershop.repository.AppointmentRepository;
import com.barbershop.repository.BarberRepository;
import com.barbershop.repository.ServiceRepository;
import com.barbershop.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class AppointmentService {

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BarberRepository barberRepository;

    @Autowired
    private ServiceRepository serviceRepository;

    @Transactional
    public Appointment bookAppointment(Long userId, Long barberId, Long serviceId, LocalDate date, LocalTime startTime) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Barber barber = barberRepository.findById(barberId)
                .orElseThrow(() -> new ResourceNotFoundException("Barber not found"));
        com.barbershop.entity.Service service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service not found"));

        LocalTime endTime = startTime.plusMinutes(service.getDuration()); // Should be 60

        // Check conflicts
        List<Appointment> conflicts = appointmentRepository.findConflictingAppointments(barberId, date, startTime, endTime);
        if (!conflicts.isEmpty()) {
            throw new ConflictException("Slot not available");
        }

        Appointment appointment = new Appointment();
        appointment.setUser(user);
        appointment.setBarber(barber);
        appointment.setService(service);
        appointment.setDate(date);
        appointment.setStartTime(startTime);
        appointment.setEndTime(endTime);
        appointment.setStatus(AppointmentStatus.BOOKED);
        appointment.setAdminViewed(false);

        return appointmentRepository.save(appointment);
    }

    @Transactional
    public Appointment cancelAppointment(Long appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
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
        // Working hours: 09:00 to 21:00
        LocalTime startOfDay = LocalTime.of(9, 0);
        LocalTime endOfDay = LocalTime.of(21, 0);

        List<LocalTime> allSlots = new ArrayList<>();
        LocalTime currentSlot = startOfDay;
        while (currentSlot.isBefore(endOfDay)) {
            allSlots.add(currentSlot);
            currentSlot = currentSlot.plusHours(1);
        }

        // Fetch booked appointments
        List<Appointment> bookedAppointments = appointmentRepository.findByBarber_IdAndDate(barberId, date);
        
        List<LocalTime> availableSlots = new ArrayList<>();
        for (LocalTime slot : allSlots) {
            boolean isBooked = false;
            LocalTime slotEnd = slot.plusHours(1);
            
            for (Appointment appt : bookedAppointments) {
                if (appt.getStatus() == AppointmentStatus.BOOKED || appt.getStatus() == AppointmentStatus.BLOCKED) {
                     // Check overlap
                     // (newStart < oldEnd) and (newEnd > oldStart)
                     if (slot.isBefore(appt.getEndTime()) && slotEnd.isAfter(appt.getStartTime())) {
                         isBooked = true;
                         break;
                     }
                 }
             }
            if (!isBooked) {
                availableSlots.add(slot);
            }
        }
        return availableSlots;
    }

    @Transactional
    public Appointment markAdminViewed(Long appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        appointment.setAdminViewed(true);
        return appointmentRepository.save(appointment);
    }

    @Transactional
    public Appointment lockSlot(Long barberId, LocalDate date, LocalTime startTime) {
        Barber barber = barberRepository.findById(barberId)
                .orElseThrow(() -> new ResourceNotFoundException("Barber not found"));

        LocalTime endTime = startTime.plusHours(1);
        List<Appointment> conflicts = appointmentRepository.findConflictingAppointments(barberId, date, startTime, endTime);
        if (!conflicts.isEmpty()) {
            throw new ConflictException("Slot not available");
        }

        Appointment appointment = new Appointment();
        appointment.setUser(null);
        appointment.setBarber(barber);
        appointment.setService(null);
        appointment.setDate(date);
        appointment.setStartTime(startTime);
        appointment.setEndTime(endTime);
        appointment.setStatus(AppointmentStatus.BLOCKED);

        return appointmentRepository.save(appointment);
    }

    @Transactional
    public Appointment unlockSlot(Long barberId, LocalDate date, LocalTime startTime) {
        Appointment blocked = appointmentRepository.findBlockedSlot(barberId, date, startTime)
                .orElseThrow(() -> new ResourceNotFoundException("Blocked slot not found"));
        appointmentRepository.delete(blocked);
        return blocked;
    }

    
}
