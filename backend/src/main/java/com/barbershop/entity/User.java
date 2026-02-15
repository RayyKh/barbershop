package com.barbershop.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "users") // 'user' is a reserved keyword in Postgres
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String firstName;

    private String phone;

    private String email;

    // For Authentication (Admin)
    private String username; // Can be email or separate
    
    @JsonIgnore
    private String password;
    
    @Enumerated(EnumType.STRING)
    private Role role; // ADMIN, CLIENT

    // Loyalty System Fields
    private int totalAppointments = 0;
    private int availableRewards = 0;
    private int usedRewards = 0;

    public enum Role {
        ADMIN,
        CLIENT
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public int getTotalAppointments() { return totalAppointments; }
    public void setTotalAppointments(int totalAppointments) { this.totalAppointments = totalAppointments; }
    public int getAvailableRewards() { return availableRewards; }
    public void setAvailableRewards(int availableRewards) { this.availableRewards = availableRewards; }
    public int getUsedRewards() { return usedRewards; }
    public void setUsedRewards(int usedRewards) { this.usedRewards = usedRewards; }
}
