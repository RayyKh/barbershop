package com.barbershop;

import com.barbershop.entity.Barber;
import com.barbershop.entity.Product;
import com.barbershop.entity.Service;
import com.barbershop.entity.User;
import com.barbershop.repository.BarberRepository;
import com.barbershop.repository.ProductRepository;
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
    private ProductRepository productRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private void saveOrUpdateService(String name, String description, Double price, Integer duration) {
        Service service = serviceRepository.findByName(name).orElse(new Service());
        service.setName(name);
        service.setDescription(description);
        service.setPrice(price);
        service.setDuration(duration);
        serviceRepository.save(service);
    }

    private void deleteService(String name) {
        serviceRepository.findByName(name).ifPresent(service -> {
            service.setActive(false);
            serviceRepository.save(service);
            System.out.println("Service désactivé (soft delete): " + name);
        });
    }

    private void saveOrUpdateBarber(String name, String speciality, String photo, String description, String username, String rawPassword) {
        User linkedUser = userRepository.findByUsername(username).orElseGet(() -> {
            User u = new User();
            u.setUsername(username);
            u.setName(name);
            u.setRole(User.Role.ADMIN);
            u.setPassword(passwordEncoder.encode(rawPassword));
            return userRepository.save(u);
        });
        Barber b = barberRepository.findByUser(linkedUser)
                .orElseGet(() -> barberRepository.findAll().stream()
                        .filter(x -> name.equalsIgnoreCase(x.getName()))
                        .findFirst()
                        .orElse(new Barber()));
        b.setName(name);
        b.setSpeciality(speciality);
        b.setPhoto(photo);
        b.setDescription(description);
        b.setUser(linkedUser);
        barberRepository.save(b);
    }
    
    private void updateBarberPhoto(String name, String photo) {
        barberRepository.findAll().stream()
                .filter(b -> b.getName() != null && b.getName().equalsIgnoreCase(name))
                .findFirst()
                .ifPresent(b -> {
                    b.setPhoto(photo);
                    barberRepository.save(b);
                });
    }

    @Override
    public void run(String... args) throws Exception {
        // Create or Update Super Admin
        User admin = userRepository.findByUsername("superadmin123").orElse(new User());
        admin.setName("Super Admin");
        admin.setUsername("superadmin123");
        admin.setPassword(passwordEncoder.encode("aladinbarbershop2026#"));
        admin.setRole(User.Role.ADMIN);
        admin.setEmail("superadmin@barber.com");
        admin.setPhone("0600000000");
        userRepository.save(admin);

        // Ensure all existing services have active status set to true by default
        serviceRepository.findAll().forEach(service -> {
            if (service.getActive() == null) {
                service.setActive(true);
                serviceRepository.save(service);
            }
        });

        // Suppression des services demandés (Soft Delete)
        deleteService("Coupe (cheveux courts)");
        deleteService("Coupe + Barbe avec machine (Zéro)");
        deleteService("Coupe + Barbe Dégradé");

        // Create or Update Default Services
        // Services principaux
        saveOrUpdateService("Barbe", "Taille de barbe", 7.0, 30);
        saveOrUpdateService("Barbe (courte)", "Taille barbe courte", 5.0, 30);
        saveOrUpdateService("Coupe", "Coupe aux ciseaux ou tondeuse", 10.0, 45);
        
        // Packs Coupe + Barbe
        saveOrUpdateService("Coupe + Barbe Dégradé + Fixation", "Pack complet avec finition", 15.0, 60);
        saveOrUpdateService("Coupe + Barbe + Brushing", "Style complet", 20.0, 60);
        saveOrUpdateService("Coupe + Barbe + Masque Noir", "Soin complet", 20.0, 60);
        
        // Enfant
        saveOrUpdateService("Coupe d'enfant (jusqu'à 5 ans)", "Coupe junior", 7.0, 30);
        
        // Soins
        saveOrUpdateService("Soin du visage (Vapozone, Scrub, Gommage, Masque Noir)", "Soin relaxant", 25.0, 60);
        saveOrUpdateService("Soin du visage (Vapozone, Scrub, Gommage, Argile Verte, Mask Gold, Patchs pour les yeux)", "Soin prestige", 50.0, 60);
        saveOrUpdateService("Protéine", "Traitement capillaire", 80.0, 90);

        // Autres services (Durée par défaut 15 min)
        saveOrUpdateService("Patchs pour les yeux", "Soin contour des yeux", 5.0, 15);
        saveOrUpdateService("Brushing", "Mise en forme", 7.0, 15);
        saveOrUpdateService("Masque Noir", "Soin purifiant", 8.0, 15);
        saveOrUpdateService("Épilation à la cire", "Nettoyage précis", 3.0, 15);

        // Create Default Barbers (Aladin, Hamouda, Ahmed)
        if (barberRepository.count() == 0) {
            barberRepository.save(new Barber(null, "Aladin", "Barbier", "ala.jpeg", "Spécialiste en coupes modernes et dégradés de précision. 10 ans d'expérience.", null));
            barberRepository.save(new Barber(null, "Hamouda", "Barbier", "hamouda.jpeg", "Expert en taille de barbe traditionnelle et soins du visage. Un savoir-faire unique.", null));
            barberRepository.save(new Barber(null, "Ahmed", "Barbier", "ahmed.jpeg", "Maîtrise parfaite des coupes classiques et des styles vintage. Le souci du détail.", null));
        }

        saveOrUpdateBarber(
                "Islem",
                "Fade Technicien",
                "islem.jpeg",
                "Barbier qui prend son temps à l’écoute, attentif à ce que tu veux vraiment, avec une bonne ambiance et de vraies discussions",
                "omar",
                "aladinbarbershop2026#"
        );

        saveOrUpdateBarber(
                "achref",
                "Le Magicien",
                "omar2.jpeg",
                "Il se distingue par sa précision et son sens du détail. Il prend son temps, écoute son client et transforme chaque coupe en véritable œuvre.",
                "achref",
                "aladinbarbershop2026#"
        );
        
        updateBarberPhoto("Hamouda", "hamouda2.jpeg");

        // Create or Update Default Products
        if (productRepository.count() < 10) {
            productRepository.deleteAll();
            productRepository.save(new Product(null, "LORENTI 07 Hair Wax Spider Effect 150ml", "La cire Spider offre une finition mate, donnant à vos cheveux un aspect naturel et non gras.", 15.0, "cirespider.jpg"));
            productRepository.save(new Product(null, "LORENTI HAIR WAX 06 PRO TOUCH 150ml", "Cire professionnelle Pro Touch pour une finition naturelle et une tenue longue durée.", 15.0, "p6.jpg"));
            productRepository.save(new Product(null, "Elegance Hair Styling Powder", "Cette poudre volumisante retravaillable est conçue pour tous les types de cheveux.", 20.0, "p2.jpg"));
            productRepository.save(new Product(null, "Elegance Paste Matte Finishing 140g", "Huile de barbe nourrissante pour une barbe douce et disciplinée.", 15.0, "p4.jpg"));
            productRepository.save(new Product(null, "Elegance Gel Hair Wax", "Gel-cire pour une brillance intense et une fixation extra forte.", 15.0, "p3.webp"));
            
            // Nouveaux produits
            productRepository.save(new Product(null, "Elegance Hair Cream Wax", "L’Elegance Hair Cream Wax possède un pouvoir fixant mais laisse les cheveux tout en souplesse.", 15.0, "1st.jpeg"));
            productRepository.save(new Product(null, "Gel capillaire de protection solide Elegance 500ml", "Offre une tenue robuste et durable qui maintient votre coiffure intacte toute la journée.", 15.0, "2nd.jpeg"));
            productRepository.save(new Product(null, "Gel pour cheveux Triple Action Elegance", "Parfait pour ceux qui cherchent à ajouter un volume extrême à leur coiffure.", 15.0, "3rd.jpeg"));
            productRepository.save(new Product(null, "Lorenti Tokyo & Seoul Hair Styling Hard Wax", "La cire dure est conçue pour offrir une performance durable.", 15.0, "4th.jpeg"));
            productRepository.save(new Product(null, "Huile de conditionnement pour cheveux et barbes E Elegance", "fournit une hydratation et une nourriture intenses pour les cheveux et la barbe.", 20.0, "5th.jpeg"));
            productRepository.save(new Product(null, "LORENTI TOKYO & SEOUL Color Hair Wax Black No.10", "cette cire capillaire donne aux cheveux clairs une couleur vive et intense qui dure toute la journée.", 15.0, "6th.jpeg"));
        }
    }
}
