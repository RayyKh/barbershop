package com.barbershop.controller;

import com.barbershop.entity.Barber;
import com.barbershop.service.BarberService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/barbers")
public class BarberController {

    @Autowired
    private BarberService barberService;

    @GetMapping
    public List<Barber> getAllBarbers() {
        return barberService.getAllBarbers();
    }

    @GetMapping("/{id}")
    public Barber getBarberById(@PathVariable Long id) {
        return barberService.getBarberById(id);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Barber createBarber(@RequestBody Barber barber) {
        return barberService.saveBarber(barber);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Barber updateBarber(@PathVariable Long id, @RequestBody Barber barber) {
        barber.setId(id);
        return barberService.saveBarber(barber);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteBarber(@PathVariable Long id) {
        barberService.deleteBarber(id);
    }
}
