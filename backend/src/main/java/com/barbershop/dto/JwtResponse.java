package com.barbershop.dto;

import lombok.Data;
import java.util.List;

@Data
public class JwtResponse {
    private String token;
    private String type = "Bearer";
    private Long id;
    private String username;
    private String email;
    private List<String> roles;
    private int totalAppointments;
    private int availableRewards;
    private int usedRewards;

    public JwtResponse(String accessToken, Long id, String username, String email, List<String> roles, int totalAppointments, int availableRewards, int usedRewards) {
        this.token = accessToken;
        this.id = id;
        this.username = username;
        this.email = email;
        this.roles = roles;
        this.totalAppointments = totalAppointments;
        this.availableRewards = availableRewards;
        this.usedRewards = usedRewards;
    }
}
