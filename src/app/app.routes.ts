import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/pages/login/login.component';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { DashboardComponent } from './features/dashboard/pages/dashboard/dashboard.component';
import { MemberListComponent } from './features/members/pages/member-list/member-list.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: LoginComponent
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'members', component: MemberListComponent },
      {
        path: 'workoutplans',
        loadComponent: () =>
            import('./features/plans/pages/plans-home/workout-plans-home.component')
            .then(m => m.WorkoutPlansHomeComponent)
        },
        {
        path: 'dietplans',
        loadComponent: () =>
            import('./features/plans/pages/plans-home/diet-plans-home.component')
            .then(m => m.DietPlansHomeComponent)
        },
        {
        path: 'plans/workouts/create',
        loadComponent: () =>
            import('./features/workouts/pages/workout-create/workout-create.component')
            .then(m => m.WorkoutCreateComponent)
        },
        {
        path: 'plans/diets/create',
        loadComponent: () =>
            import('./features/diet/pages/diet-create/diet-create.component')
            .then(m => m.DietCreateComponent)
        },

      {
       path: 'members/create',
        loadComponent: () =>
            import('./features/members/pages/member-create/member-create.component')
            .then(m => m.MemberCreateComponent)
       },
       {
        path: 'members/:memberId',
        loadComponent: () =>
            import('./features/members/pages/member-profile/member-profile.component')
            .then(m => m.MemberProfileComponent)
        },
        {
        path: 'members/:memberId/edit',
        loadComponent: () =>
            import('./features/members/pages/member-edit/member-edit.component')
            .then(m => m.MemberEditComponent)
        },
        {
            path: 'members/:memberId/workouts/create',
            loadComponent: () =>
                import('./features/workouts/pages/workout-create/workout-create.component')
                .then(m => m.WorkoutCreateComponent)
        },
        // {
        //     path: 'workouts/:planId/edit',
        //     loadComponent: () =>
        //         import('./features/workouts/pages/workout-edit/workout-edit.component')
        //         .then(m => m.WorkoutEditComponent)
        // },
        {
        path: 'members/:memberId/diet/create',
        loadComponent: () =>
            import('./features/diet/pages/diet-create/diet-create.component')
            .then(m => m.DietCreateComponent)
        },
      {
        path: 'checkins/create',
        loadComponent: () =>
            import('./features/checkin/pages/checkin-create/checkin-create.component')
            .then(m => m.CheckinCreateComponent)
        },
      {
        path: 'billing',
        loadComponent: () =>
            import('./features/billing/pages/billing-home/billing-home.component')
            .then(m => m.BillingHomeComponent)
        },
      {
        path: 'exercise-library',
        loadComponent: () =>
            import('./features/exercise-library/pages/exercise-library-home/exercise-library-home.component')
            .then(m => m.ExerciseLibraryHomeComponent)
        },
      {
        path: 'diet-library',
        loadComponent: () =>
            import('./features/diet-library/pages/diet-library-home/diet-library-home.component')
            .then(m => m.DietLibraryHomeComponent)
        }

        // {
        // path: 'diet/:planId/edit',
        // loadComponent: () =>
        //     import('./features/diet/pages/diet-edit/diet-edit.component')
        //     .then(m => m.DietEditComponent)
        // }



    ]
  }
];
