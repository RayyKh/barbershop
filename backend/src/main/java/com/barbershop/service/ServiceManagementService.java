package com.barbershop.service;

import com.barbershop.entity.Service;
import com.barbershop.repository.ServiceRepository;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

@org.springframework.stereotype.Service
public class ServiceManagementService {

    @Autowired
    private ServiceRepository serviceRepository;

    public List<Service> getAllServices() {
        return serviceRepository.findByActiveTrue();
    }

    public List<Service> getAllServicesIncludingInactive() {
        return serviceRepository.findAll();
    }

    public Service getServiceById(Long id) {
        return serviceRepository.findById(id).orElse(null);
    }

    public Service saveService(Service service) {
        if (service.getActive() == null) {
            service.setActive(true);
        }
        return serviceRepository.save(service);
    }
    
    public void deleteService(Long id) {
        Service service = serviceRepository.findById(id).orElse(null);
        if (service != null) {
            service.setActive(false);
            serviceRepository.save(service);
        }
    }
}
