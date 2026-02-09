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
            serviceRepository.save(new Service(null, "Coupe", "Coupe aux ciseaux ou tondeuse", 10.0, 30));
            serviceRepository.save(new Service(null, "Barbe", "Taille de barbe", 7.0, 20));
            serviceRepository.save(new Service(null, "Coupe + Barbe avec machine (Zéro)", "Pack complet tondeuse", 10.0, 40));
            serviceRepository.save(new Service(null, "Coupe + Barbe Dégradé", "Pack dégradé précis", 13.0, 45));
            serviceRepository.save(new Service(null, "Coupe + Barbe Dégradé + Fixation", "Pack complet avec finition", 15.0, 50));
            serviceRepository.save(new Service(null, "Coupe + Barbe + Brushing", "Style complet", 20.0, 60));
            serviceRepository.save(new Service(null, "Coupe + Barbe + Masque Noir", "Soin complet", 20.0, 60));
            serviceRepository.save(new Service(null, "Patchs pour les yeux", "Soin contour des yeux", 5.0, 10));
            serviceRepository.save(new Service(null, "Coupe d'enfant (jusqu'à 5 ans)", "Coupe junior", 7.0, 20));
            serviceRepository.save(new Service(null, "Brushing", "Mise en forme", 7.0, 15));
            serviceRepository.save(new Service(null, "Masque Noir", "Soin purifiant", 8.0, 15));
            serviceRepository.save(new Service(null, "Épilation à la cire", "Nettoyage précis", 3.0, 10));
            serviceRepository.save(new Service(null, "Soin du visage (Vapozone, Scrub, Gommage, Masque Noir)", "Soin relaxant", 25.0, 40));
            serviceRepository.save(new Service(null, "Soin du visage (Vapozone, Scrub, Gommage, Argile Verte, Mask Gold, Patchs pour les yeux)", "Soin prestige", 50.0, 60));
            serviceRepository.save(new Service(null, "Protéine", "Traitement capillaire", 80.0, 90));
        }

        // Create Default Barbers (Aladin, Hamouda, Ahmed)
        if (barberRepository.count() == 0) {
            barberRepository.save(new Barber(null, "Aladin", "Barbier", "ala.jpeg", "Spécialiste en coupes modernes et dégradés de précision. 10 ans d'expérience."));
            barberRepository.save(new Barber(null, "Hamouda", "Barbier", "hamouda.jpeg", "Expert en taille de barbe traditionnelle et soins du visage. Un savoir-faire unique."));
            barberRepository.save(new Barber(null, "Ahmed", "Barbier", "ahmed.jpeg", "Maîtrise parfaite des coupes classiques et des styles vintage. Le souci du détail."));
        }
    }
}
