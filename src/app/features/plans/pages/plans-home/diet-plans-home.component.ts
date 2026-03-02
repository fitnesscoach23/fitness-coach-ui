import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-plans-home',
  templateUrl: './diet-plans-home.component.html',
  styleUrls: ['./diet-plans-home.component.scss']
})
export class DietPlansHomeComponent {

  constructor(private router: Router) {}

  createDiet() {
    this.router.navigate(['/plans/diets/create']);
  }
}
