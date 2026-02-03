package com.barbershop;

import com.barbershop.entity.Barber;
import com.barbershop.entity.Service;
import com.barbershop.entity.User;
import com.barbershop.repository.BarberRepository;
import com.barbershop.repository.ServiceRepository;
import com.barbershop.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ServiceRepository serviceRepository;

    @Autowired
    private BarberRepository barberRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Create or Update Super Admin
        User admin = userRepository.findByUsername("superadmin123").orElse(new User());
        admin.setName("Super Admin");
        admin.setUsername("superadmin123");
        admin.setPassword(passwordEncoder.encode("aladinbarbershop123"));
        admin.setRole(User.Role.ADMIN);
        admin.setEmail("superadmin@barber.com");
        admin.setPhone("0600000000");
        userRepository.save(admin);

        // Create Default Services
        if (serviceRepository.count() == 0) {
            serviceRepository.save(new Service(null, "Coupe Classique", "Coupe aux ciseaux et tondeuse", 25.0, 60));
            serviceRepository.save(new Service(null, "Barbe & Soin", "Taille de barbe et soin complet", 20.0, 60));
            serviceRepository.save(new Service(null, "Complet", "Coupe + Barbe", 40.0, 60));
        }

        // Create Default Barbers (Ala, Hamouda, Ahmed)
        if (barberRepository.count() == 0) {
            barberRepository.save(new Barber(null, "Ala", "Barbier", ""));
            barberRepository.save(new Barber(null, "Hamouda", "Barbier", ""));
            barberRepository.save(new Barber(null, "Ahmed", "Barbier", ""));
        }
    }
}
