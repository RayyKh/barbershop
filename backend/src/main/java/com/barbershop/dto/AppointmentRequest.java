package com.barbershop.dto;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class AppointmentRequest {
    private Long barberId;
    private java.util.List<Long> serviceIds;
    private LocalDate date;
    private LocalTime startTime;
    
    // User details for guest booking
    private String userName;
    private String userFirstName;
    private String userPhone;
    private String userEmail;
    private boolean useReward;

    public Long getBarberId() { return barberId; }
    public java.util.List<Long> getServiceIds() { return serviceIds; }
    public LocalDate getDate() { return date; }
    public LocalTime getStartTime() { return startTime; }
    public String getUserName() { return userName; }
    public String getUserFirstName() { return userFirstName; }
    public String getUserPhone() { return userPhone; }
    public String getUserEmail() { return userEmail; }
    public boolean isUseReward() { return useReward; }
    public void setUseReward(boolean useReward) { this.useReward = useReward; }
}
