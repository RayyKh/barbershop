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

        // Create or Update Default Services
        saveOrUpdateService("Coupe", "Coupe aux ciseaux ou tondeuse", 10.0, 30);
        saveOrUpdateService("Barbe", "Taille de barbe", 7.0, 30);
        saveOrUpdateService("Coupe (cheveux courts)", "Coupe cheveux courts", 8.0, 30);
        saveOrUpdateService("Barbe (courte)", "Taille barbe courte", 5.0, 30);
        saveOrUpdateService("Coupe + Barbe avec machine (Zéro)", "Pack complet tondeuse", 10.0, 45);
        saveOrUpdateService("Coupe + Barbe Dégradé", "Pack dégradé précis", 13.0, 45);
        saveOrUpdateService("Coupe + Barbe Dégradé + Fixation", "Pack complet avec finition", 15.0, 45);
        saveOrUpdateService("Coupe + Barbe + Brushing", "Style complet", 20.0, 45);
        saveOrUpdateService("Coupe + Barbe + Masque Noir", "Soin complet", 20.0, 45);
        saveOrUpdateService("Patchs pour les yeux", "Soin contour des yeux", 5.0, 15);
        saveOrUpdateService("Coupe d'enfant (jusqu'à 5 ans)", "Coupe junior", 7.0, 30);
        saveOrUpdateService("Brushing", "Mise en forme", 7.0, 15);
        saveOrUpdateService("Masque Noir", "Soin purifiant", 8.0, 15);
        saveOrUpdateService("Épilation à la cire", "Nettoyage précis", 3.0, 15);
        saveOrUpdateService("Soin du visage (Vapozone, Scrub, Gommage, Masque Noir)", "Soin relaxant", 25.0, 45);
        saveOrUpdateService("Soin du visage (Vapozone, Scrub, Gommage, Argile Verte, Mask Gold, Patchs pour les yeux)", "Soin prestige", 50.0, 45);
        saveOrUpdateService("Protéine", "Traitement capillaire", 80.0, 90);

        // Create Default Barbers (Aladin, Hamouda, Ahmed)
        if (barberRepository.count() == 0) {
            barberRepository.save(new Barber(null, "Aladin", "Barbier", "ala.jpeg", "Spécialiste en coupes modernes et dégradés de précision. 10 ans d'expérience.", null));
            barberRepository.save(new Barber(null, "Hamouda", "Barbier", "hamouda.jpeg", "Expert en taille de barbe traditionnelle et soins du visage. Un savoir-faire unique.", null));
            barberRepository.save(new Barber(null, "Ahmed", "Barbier", "ahmed.jpeg", "Maîtrise parfaite des coupes classiques et des styles vintage. Le souci du détail.", null));
        }

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
