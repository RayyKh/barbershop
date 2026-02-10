package com.barbershop.controller;

import com.barbershop.service.PushNotificationService;
import nl.martijndwars.webpush.Subscription;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
public class PushNotificationController {

    private final PushNotificationService pushNotificationService;

    public PushNotificationController(PushNotificationService pushNotificationService) {
        this.pushNotificationService = pushNotificationService;
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(
            @RequestBody SubscriptionRequest request, 
            Authentication authentication) {
        
        System.out.println("DEBUG: Push subscribe attempt for user: " + (authentication != null ? authentication.getName() : "null"));
        
        if (authentication == null || !authentication.isAuthenticated()) {
            System.err.println("DEBUG: Push subscribe failed - User not authenticated");
            return ResponseEntity.status(401).build();
        }
        
        if (request.getSubscription() == null) {
            System.err.println("DEBUG: Push subscribe failed - Subscription object is null");
            return ResponseEntity.badRequest().build();
        }

        try {
            pushNotificationService.subscribe(
                authentication.getName(), 
                request.getSubscription(), 
                request.getBarberId()
            );
            System.out.println("DEBUG: Push subscribe SUCCESS for user: " + authentication.getName());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            System.err.println("DEBUG: Push subscribe EXCEPTION: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    public static class SubscriptionRequest {
        private Subscription subscription;
        private Long barberId;

        public Subscription getSubscription() { return subscription; }
        public void setSubscription(Subscription subscription) { this.subscription = subscription; }
        public Long getBarberId() { return barberId; }
        public void setBarberId(Long barberId) { this.barberId = barberId; }
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<Void> unsubscribe(@RequestBody String endpoint) {
        pushNotificationService.unsubscribe(endpoint);
        return ResponseEntity.ok().build();
    }
}
