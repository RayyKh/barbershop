package com.barbershop.controller;

import com.barbershop.entity.AdminMessage;
import com.barbershop.service.AdminMessageService;
import com.barbershop.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/admin/chat")
public class AdminMessageController {

    @Autowired
    private AdminMessageService adminMessageService;

    @Autowired
    private JwtUtils jwtUtils;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('BARBER')")
    public ResponseEntity<List<AdminMessage>> getAllMessages() {
        return ResponseEntity.ok(adminMessageService.getAllMessages());
    }

    public static class MessageRequest {
        public String content;
        public Long senderId;
        public String senderName;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('BARBER')")
    public ResponseEntity<AdminMessage> sendMessage(@RequestBody MessageRequest payload) {
        if (payload.content == null || payload.content.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(adminMessageService.sendMessage(payload.content, payload.senderId, payload.senderName));
    }

    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");
        if (headerAuth != null && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }
        return null;
    }
}
