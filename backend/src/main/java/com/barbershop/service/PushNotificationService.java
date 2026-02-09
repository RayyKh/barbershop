package com.barbershop.service;

import com.barbershop.entity.PushSubscription;
import com.barbershop.entity.User;
import com.barbershop.repository.PushSubscriptionRepository;
import com.barbershop.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Security;
import java.util.List;

@Service
public class PushNotificationService {

    @Value("${vapid.public.key}")
    private String publicKey;

    @Value("${vapid.private.key}")
    private String privateKey;

    @Value("${vapid.subject}")
    private String subject;

    private final PushSubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private PushService pushService;

    public PushNotificationService(PushSubscriptionRepository subscriptionRepository, UserRepository userRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
    }

    @PostConstruct
    public void init() throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        pushService = new PushService(publicKey, privateKey, subject);
    }

    @Transactional
    public void subscribe(String username, Subscription subscription) {
        userRepository.findByUsername(username).ifPresent(user -> {
            // Check if subscription already exists
            subscriptionRepository.findByEndpoint(subscription.endpoint)
                .ifPresentOrElse(
                    existing -> existing.setUser(user),
                    () -> {
                        PushSubscription newSub = new PushSubscription();
                        newSub.setEndpoint(subscription.endpoint);
                        newSub.setP256dh(subscription.keys.p256dh);
                        newSub.setAuth(subscription.keys.auth);
                        newSub.setUser(user);
                        subscriptionRepository.save(newSub);
                    }
                );
        });
    }

    @Transactional
    public void unsubscribe(String endpoint) {
        subscriptionRepository.deleteByEndpoint(endpoint);
    }

    public void sendNotificationToAdmins(String title, String message) {
        List<PushSubscription> adminSubscriptions = subscriptionRepository.findByUserRole(User.Role.ADMIN);
        System.out.println("DEBUG: Tentative d'envoi de notification à " + adminSubscriptions.size() + " abonnements admin.");
        
        for (PushSubscription sub : adminSubscriptions) {
            try {
                System.out.println("DEBUG: Envoi à l'utilisateur: " + sub.getUser().getUsername() + " (Rôle: " + sub.getUser().getRole() + ")");
                Subscription subscription = new Subscription(
                    sub.getEndpoint(),
                    new Subscription.Keys(sub.getP256dh(), sub.getAuth())
                );

                Notification notification = new Notification(
                    subscription,
                    String.format("{\"notification\":{\"title\":\"%s\", \"body\":\"%s\", \"icon\":\"/assets/logo.png\"}}", title, message)
                );
                
                System.out.println("DEBUG: JSON envoyé -> " + notification.getPayload());

                pushService.send(notification);
                System.out.println("DEBUG: Notification envoyée avec succès à l'endpoint: " + sub.getEndpoint());
            } catch (Exception e) {
                System.err.println("DEBUG ERROR: Échec de l'envoi à " + sub.getEndpoint() + " - Erreur: " + e.getMessage());
                if (e.getMessage().contains("410") || e.getMessage().contains("404")) {
                    subscriptionRepository.delete(sub);
                    System.out.println("DEBUG: Abonnement obsolète supprimé.");
                }
            }
        }
    }
}
