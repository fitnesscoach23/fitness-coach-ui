import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-plans-home',
  templateUrl: './workout-plans-home.component.html',
  styleUrls: ['./workout-plans-home.component.scss']
})
export class WorkoutPlansHomeComponent {

  constructor(private router: Router) {}

  createWorkout() {
    this.router.navigate(['/plans/workouts/create']);
  }
}
