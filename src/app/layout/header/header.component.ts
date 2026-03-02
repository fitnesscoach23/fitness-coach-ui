import { Component } from '@angular/core';
import { TokenService } from '../../core/services/token.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {

  constructor(
    private tokenService: TokenService,
    private router: Router
  ) {}

  logout() {
    this.tokenService.clear();
    this.router.navigate(['/']);
  }
}
