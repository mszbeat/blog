import { ConflictException, InternalServerErrorException, UnauthorizedException } from "@nestjs/common"

export const RESPONSE_MESSAGES = {
  AUTH: {
    register: data => ({
      message: {
        en: 'User created successfully',
        fa: 'کاربر با موفقیت ایجاد شد'
      },
      data
    }),
    login: data => ({
      message: {
        en: 'Login successful',
        fa: 'با موفقیت وارد شدید'
      },
      data
    }),
    refreshToken: data => ({
      message: {
        fa: 'توکن جدبد با موفقیت ساخته شد',
        en: 'Token refreshed successfully'
      },
      data
    }),
    logout: {
      message: {
        en: 'Logged out successfully',
        fa: 'با موفقیت خارج شد'
      }
    },
    getMe: data => ({
      message: {
        en: 'Profile retrieved successfully',
        fa: 'پروفایل با موفقیت بازیابی شد'
      },
      data
    })
  },
  USERS: {
    create: data => ({
      message: {
        en: 'User created successfully',
        fa: 'کاربر با موفقیت ایجاد شد'
      },
      data
    }),
    findOne: data => ({
      message: {
        fa: 'کاربر با موفقیت بازیابی شد',
        en: 'User retrieved successfully'
      },
      data
    }),
    updateUser: data => ({
      message: {
        fa: 'کاربر با موفقیت به‌روزرسانی شد',
        en: 'User updated successfully'
      },
      data
    }),
    deleteUser: {
      message: {
        fa: 'کاربر با موفقیت حذف شد',
        en: 'User deleted successfully'
      }
    },
    changePassword: {
      message: {
        fa: 'رمز عبور با موفقیت به‌روزرسانی شد',
        en: 'Password updated successfully'
      }
    },

  }
}

export const ERROR_MESSAGES = {
  AUTH: {
    invalidCredentials: new UnauthorizedException({
      message: {
        en: 'Invalid credentials',
        fa: 'اطلاعات ورود نامعتبر است'
      }
    }),
    invalidSessionOrToken: new UnauthorizedException({
      message: {
        en: 'Invalid session or refresh token',
        fa: 'جلسه یا توکن تازه‌سازی نامعتبر است'
      }
    })
  },
  USERS: {
    emailAlreadyExists: new ConflictException({
      message: {
        en: 'Email already exists',
        fa: 'ایمیل قبلاً استفاده شده است'
      }
    }),
    userNotFound: new UnauthorizedException({
      message: {
        en: 'User not found',
        fa: 'کاربر یافت نشد'
      }
    }),
    conflictPassword: new ConflictException({
      message: {
        en: 'New password cannot be the same as the current password',
        fa: 'رمز عبور جدید نمی‌تواند با رمز عبور فعلی یکسان باشد'
      }
    }),
    wrongPassword: new ConflictException({
      message: {
        en: 'password is incorrect',
        fa: 'رمز عبور نادرست است'
      }
    })
  },
  INTERNAL_ERROR: error => {
    throw new InternalServerErrorException(error)
  }
}