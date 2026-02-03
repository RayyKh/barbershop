package com.barbershop.controller;

import com.barbershop.entity.Service;
import com.barbershop.service.ServiceManagementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/services")
public class ServiceController {

    @Autowired
    private ServiceManagementService serviceManagementService;

    @GetMapping
    public List<Service> getAllServices() {
        return serviceManagementService.getAllServices();
    }

    @GetMapping("/{id}")
    public Service getServiceById(@PathVariable Long id) {
        return serviceManagementService.getServiceById(id);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Service createService(@RequestBody Service service) {
        return serviceManagementService.saveService(service);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Service updateService(@PathVariable Long id, @RequestBody Service service) {
        service.setId(id);
        return serviceManagementService.saveService(service);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteService(@PathVariable Long id) {
        serviceManagementService.deleteService(id);
    }
}
