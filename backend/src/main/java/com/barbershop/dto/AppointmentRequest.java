package com.barbershop.dto;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class AppointmentRequest {
    private Long barberId;
    private Long serviceId;
    private LocalDate date;
    private LocalTime startTime;
    
    // User details for guest booking
    private String userName;
    private String userPhone;
    private String userEmail;

    public Long getBarberId() { return barberId; }
    public Long getServiceId() { return serviceId; }
    public LocalDate getDate() { return date; }
    public LocalTime getStartTime() { return startTime; }
    public String getUserName() { return userName; }
    public String getUserPhone() { return userPhone; }
    public String getUserEmail() { return userEmail; }
}
