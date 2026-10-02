import { User } from '../entities/user.entity';

/** Shape returned by GET /users/:id/public — see UsersController.publicProfile. */
export interface PublicProfile {
  user: Omit<User, 'password'>;
  stats: {
    posts: number;
    views: number;
    likes: number;
    followers: number;
    following: number;
  };
  /** Only meaningful for an authenticated viewer who is not the owner. */
  isFollowing: boolean;
  isSelf: boolean;
}
