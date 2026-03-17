package com.barbershop.repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.barbershop.entity.Appointment;
import com.barbershop.entity.AppointmentStatus;
import com.barbershop.entity.Barber;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    List<Appointment> findByBarberAndDate(Barber barber, LocalDate date);
    
    List<Appointment> findByBarber_IdAndDate(Long barberId, LocalDate date);

    List<Appointment> findByDate(LocalDate date);
    
    List<Appointment> findByUser_Id(Long userId);

    List<Appointment> findByBarber_IdAndStatusAndDateBetween(Long barberId, AppointmentStatus status, LocalDate start, LocalDate end);

    @Query("SELECT a FROM Appointment a WHERE a.barber.id = :barberId " +
           "AND a.date = :date " +
           "AND a.status IN ('BOOKED','BLOCKED','MODIFIED')")
    List<Appointment> findActiveByBarberAndDate(
            @Param("barberId") Long barberId,
            @Param("date") LocalDate date);

    @Query("SELECT a FROM Appointment a WHERE a.barber.id = :barberId AND a.date = :date AND a.startTime = :startTime AND a.status = 'BLOCKED'")
    java.util.Optional<Appointment> findBlockedSlot(
            @Param("barberId") Long barberId,
            @Param("date") LocalDate date,
            @Param("startTime") LocalTime startTime
    );

    long countByStatusAndAdminViewedFalse(AppointmentStatus status);
}
