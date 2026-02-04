package com.barbershop.repository;

import com.barbershop.entity.Appointment;
import com.barbershop.entity.AppointmentStatus;
import com.barbershop.entity.Barber;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    List<Appointment> findByBarberAndDate(Barber barber, LocalDate date);
    
    List<Appointment> findByBarber_IdAndDate(Long barberId, LocalDate date);

    List<Appointment> findByDate(LocalDate date);
    
    List<Appointment> findByUser_Id(Long userId);

    @Query("SELECT a FROM Appointment a WHERE a.barber.id = :barberId " +
           "AND a.date = :date " +
           "AND a.status IN ('BOOKED','BLOCKED','MODIFIED') " +
           "AND ((:startTime < a.endTime) AND (:endTime > a.startTime))")
    List<Appointment> findConflictingAppointments(
            @Param("barberId") Long barberId,
            @Param("date") LocalDate date,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime);

    @Query("SELECT a FROM Appointment a WHERE a.barber.id = :barberId AND a.date = :date AND a.startTime = :startTime AND a.status = 'BLOCKED'")
    java.util.Optional<Appointment> findBlockedSlot(
            @Param("barberId") Long barberId,
            @Param("date") LocalDate date,
            @Param("startTime") LocalTime startTime
    );

    long countByStatusAndAdminViewedFalse(AppointmentStatus status);
}
