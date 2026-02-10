import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Product } from '../../services/api.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    MatTableModule, 
    MatButtonModule, 
    MatIconModule, 
    MatFormFieldModule, 
    MatInputModule,
    MatSnackBarModule
  ],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.scss'
})
export class AdminProductsComponent implements OnInit {
  products: Product[] = [];
  productForm: FormGroup;
  editingId: number | null = null;
  showForm = false;
  displayedColumns: string[] = ['photo', 'name', 'price', 'actions'];

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.productForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      photo: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.api.getProducts().subscribe(data => this.products = data);
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.productForm.reset({ price: 0 });
    this.editingId = null;
    this.showForm = false;
  }

  onEdit(product: Product): void {
    this.editingId = product.id!;
    this.productForm.patchValue(product);
    this.showForm = true;
  }

  onDelete(id: number): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      this.api.deleteProduct(id).subscribe(() => {
        this.snackBar.open('Produit supprimé', 'OK', { duration: 3000 });
        this.loadProducts();
      });
    }
  }

  onSubmit(): void {
    if (this.productForm.valid) {
      const productData = this.productForm.value;
      if (this.editingId) {
        this.api.updateProduct(this.editingId, productData).subscribe(() => {
          this.snackBar.open('Produit mis à jour', 'OK', { duration: 3000 });
          this.loadProducts();
          this.resetForm();
        });
      } else {
        this.api.createProduct(productData).subscribe(() => {
          this.snackBar.open('Produit ajouté', 'OK', { duration: 3000 });
          this.loadProducts();
          this.resetForm();
        });
      }
    }
  }
}
