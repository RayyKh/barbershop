package com.barbershop.dto;

import java.time.LocalTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class AppointmentRequest {
    @NotNull
    private Long barberId;

    @NotEmpty
    private java.util.List<Long> serviceIds;

    @NotBlank
    @Pattern(regexp = "^\\d{2}/\\d{2}/\\d{4}$")
    private String date;

    @NotNull
    private LocalTime startTime;
    
    // User details for guest booking
    private String userName;
    private String userFirstName;
    private String userPhone;
    private String userEmail;

    public Long getBarberId() { return barberId; }
    public java.util.List<Long> getServiceIds() { return serviceIds; }
    public String getDate() { return date; }
    public LocalTime getStartTime() { return startTime; }
    public String getUserName() { return userName; }
    public String getUserFirstName() { return userFirstName; }
    public String getUserPhone() { return userPhone; }
    public String getUserEmail() { return userEmail; }
}
