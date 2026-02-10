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
    private final com.barbershop.repository.BarberRepository barberRepository;
    private PushService pushService;

    public PushNotificationService(PushSubscriptionRepository subscriptionRepository, 
                                 UserRepository userRepository,
                                 com.barbershop.repository.BarberRepository barberRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
        this.barberRepository = barberRepository;
    }

    @PostConstruct
    public void init() throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        pushService = new PushService(publicKey, privateKey, subject);
    }

    @Transactional
    public void subscribe(String username, Subscription subscription, Long barberId) {
        userRepository.findByUsername(username).ifPresent(user -> {
            // Check if subscription already exists
            subscriptionRepository.findByEndpoint(subscription.endpoint)
                .ifPresentOrElse(
                    existing -> {
                        existing.setUser(user);
                        if (barberId != null) {
                            barberRepository.findById(barberId).ifPresent(existing::setBarber);
                        } else {
                            existing.setBarber(null);
                        }
                    },
                    () -> {
                        PushSubscription newSub = new PushSubscription();
                        newSub.setEndpoint(subscription.endpoint);
                        newSub.setP256dh(subscription.keys.p256dh);
                        newSub.setAuth(subscription.keys.auth);
                        newSub.setUser(user);
                        if (barberId != null) {
                            barberRepository.findById(barberId).ifPresent(newSub::setBarber);
                        }
                        subscriptionRepository.save(newSub);
                    }
                );
        });
    }

    @Transactional
    public void unsubscribe(String endpoint) {
        subscriptionRepository.deleteByEndpoint(endpoint);
    }

    public void sendNotificationToBarber(Long barberId, String title, String message) {
        // 1. Envoyer à tous les abonnements spécifiquement liés à ce barbier
        List<PushSubscription> barberSubscriptions = subscriptionRepository.findByBarberId(barberId);
        sendToSubscriptions(barberSubscriptions, title, message);
        
        // 2. Envoyer aussi aux administrateurs généraux (qui n'ont pas choisi de barbier spécifique)
        List<PushSubscription> generalAdminSubscriptions = subscriptionRepository.findByUserRole(User.Role.ADMIN)
            .stream()
            .filter(sub -> sub.getBarber() == null)
            .toList();
        sendToSubscriptions(generalAdminSubscriptions, title, message);
    }

    public void sendNotificationToUser(User user, String title, String message) {
        if (user == null) return;
        List<PushSubscription> userSubscriptions = subscriptionRepository.findByUser(user);
        sendToSubscriptions(userSubscriptions, title, message);
    }

    public void sendNotificationToAdmins(String title, String message) {
        List<PushSubscription> adminSubscriptions = subscriptionRepository.findByUserRole(User.Role.ADMIN);
        sendToSubscriptions(adminSubscriptions, title, message);
    }

    private void sendToSubscriptions(List<PushSubscription> subscriptions, String title, String message) {
        System.out.println("DEBUG: Tentative d'envoi de notification à " + subscriptions.size() + " abonnements.");
        
        for (PushSubscription sub : subscriptions) {
            try {
                Subscription subscription = new Subscription(
                    sub.getEndpoint(),
                    new Subscription.Keys(sub.getP256dh(), sub.getAuth())
                );

                Notification notification = new Notification(
                    subscription,
                    String.format("{\"notification\":{\"title\":\"%s\", \"body\":\"%s\", \"icon\":\"/assets/logo.png\"}}", title, message)
                );
                
                pushService.send(notification);
                System.out.println("DEBUG: Notification envoyée avec succès à l'endpoint: " + sub.getEndpoint());
            } catch (Exception e) {
                System.err.println("DEBUG ERROR: Échec de l'envoi à " + sub.getEndpoint() + " - Erreur: " + e.getMessage());
                if (e.getMessage().contains("410") || e.getMessage().contains("404")) {
                    subscriptionRepository.delete(sub);
                }
            }
        }
    }
}
