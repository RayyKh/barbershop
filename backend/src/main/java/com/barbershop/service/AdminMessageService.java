package com.barbershop.service;

import com.barbershop.entity.AdminMessage;
import com.barbershop.repository.AdminMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AdminMessageService {

    @Autowired
    private AdminMessageRepository adminMessageRepository;

    public List<AdminMessage> getAllMessages() {
        return adminMessageRepository.findAllByOrderByTimestampAsc();
    }

    public AdminMessage sendMessage(String content, Long senderId, String senderName) {
        AdminMessage message = new AdminMessage(content, senderId, senderName);
        return adminMessageRepository.save(message);
    }
}
