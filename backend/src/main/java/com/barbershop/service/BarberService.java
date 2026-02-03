package com.barbershop.service;

import com.barbershop.entity.Barber;
import com.barbershop.repository.BarberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class BarberService {

    @Autowired
    private BarberRepository barberRepository;

    public List<Barber> getAllBarbers() {
        return barberRepository.findAll();
    }

    public Barber getBarberById(Long id) {
        return barberRepository.findById(id).orElse(null);
    }

    public Barber saveBarber(Barber barber) {
        return barberRepository.save(barber);
    }
    
    public void deleteBarber(Long id) {
        barberRepository.deleteById(id);
    }
}
