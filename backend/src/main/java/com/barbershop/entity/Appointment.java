package com.barbershop.entity;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Appointment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "date", columnDefinition = "DATE")
    private LocalDate date;

    private LocalTime startTime;

    private LocalTime endTime; // Calculated as startTime + 60 mins

    @Enumerated(EnumType.STRING)
    private AppointmentStatus status;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "barber_id")
    private Barber barber;

    @ManyToMany
    @JoinTable(
        name = "appointment_services",
        joinColumns = @JoinColumn(name = "appointment_id"),
        inverseJoinColumns = @JoinColumn(name = "service_id")
    )
    private List<Service> services = new java.util.ArrayList<>();

    private Double totalPrice;

    private boolean adminViewed = false;

    @Column(name = "reward_applied", nullable = false)
    private boolean rewardApplied = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    public AppointmentStatus getStatus() { return status; }
    public void setStatus(AppointmentStatus status) { this.status = status; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Barber getBarber() { return barber; }
    public void setBarber(Barber barber) { this.barber = barber; }
    public List<Service> getServices() { return services; }
    public void setServices(List<Service> services) { this.services = services; }
    public Double getTotalPrice() { return totalPrice; }
    public void setTotalPrice(Double totalPrice) { this.totalPrice = totalPrice; }
    public boolean isAdminViewed() { return adminViewed; }
    public void setAdminViewed(boolean adminViewed) { this.adminViewed = adminViewed; }
    public boolean isRewardApplied() { return rewardApplied; }
    public void setRewardApplied(boolean rewardApplied) { this.rewardApplied = rewardApplied; }
}
