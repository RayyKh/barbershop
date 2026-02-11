package com.barbershop.dto;

import lombok.Data;
import java.util.Set;

@Data
public class SignupRequest {
    private String username;
    private String email;
    private String password;
    private String name;
    private String firstName;
    private String phone;
    private Set<String> role;

    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public String getName() { return name; }
    public String getFirstName() { return firstName; }
    public String getPhone() { return phone; }
    public Set<String> getRole() { return role; }
}
