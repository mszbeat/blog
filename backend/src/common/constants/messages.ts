import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

export const RESPONSE_MESSAGES = {
  AUTH: {
    register: (data) => ({
      message: {
        en: 'User created successfully',
        fa: 'کاربر با موفقیت ایجاد شد',
      },
      data,
    }),
    login: (data) => ({
      message: {
        en: 'Login successful',
        fa: 'با موفقیت وارد شدید',
      },
      data,
    }),
    refreshToken: (data) => ({
      message: {
        fa: 'توکن جدبد با موفقیت ساخته شد',
        en: 'Token refreshed successfully',
      },
      data,
    }),
    logout: {
      message: {
        en: 'Logged out successfully',
        fa: 'با موفقیت خارج شد',
      },
    },
    getMe: (data) => ({
      message: {
        en: 'Profile retrieved successfully',
        fa: 'پروفایل با موفقیت بازیابی شد',
      },
      data,
    }),
  },
  USERS: {
    create: (data) => ({
      message: {
        en: 'User created successfully',
        fa: 'کاربر با موفقیت ایجاد شد',
      },
      data,
    }),
    findOne: (data) => ({
      message: {
        fa: 'کاربر با موفقیت بازیابی شد',
        en: 'User retrieved successfully',
      },
      data,
    }),
    updateUser: (data) => ({
      message: {
        fa: 'کاربر با موفقیت به‌روزرسانی شد',
        en: 'User updated successfully',
      },
      data,
    }),
    deleteUser: {
      message: {
        fa: 'کاربر با موفقیت حذف شد',
        en: 'User deleted successfully',
      },
    },
    changePassword: {
      message: {
        fa: 'رمز عبور با موفقیت به‌روزرسانی شد',
        en: 'Password updated successfully',
      },
    },
    publicProfile: (data) => ({
      message: {
        fa: 'پروفایل با موفقیت بازیابی شد',
        en: 'Profile retrieved successfully',
      },
      data,
    }),
  },
  POSTS: {
    create: (data) => ({
      message: {
        en: 'New post created successfully',
        fa: 'پست جدید با موفقیت ایجاد شد',
      },
      data,
    }),
  },
  SOCIAL: {
    follow: (data) => ({
      message: {
        en: 'User followed successfully',
        fa: 'کاربر با موفقیت دنبال شد',
      },
      data,
    }),
    unfollow: (data) => ({
      message: {
        en: 'User unfollowed successfully',
        fa: 'دنبال‌کردن با موفقیت لغو شد',
      },
      data,
    }),
    like: (data) => ({
      message: {
        en: 'Post liked successfully',
        fa: 'پست با موفقیت لایک شد',
      },
      data,
    }),
    unlike: (data) => ({
      message: {
        en: 'Like removed successfully',
        fa: 'لایک با موفقیت برداشته شد',
      },
      data,
    }),
  },
  NOTIFICATIONS: {
    findAll: (data) => ({
      message: {
        en: 'Notifications retrieved successfully',
        fa: 'اعلان‌ها با موفقیت بازیابی شدند',
      },
      data,
    }),
    unread: (data) => ({
      message: {
        en: 'Unread count retrieved successfully',
        fa: 'تعداد اعلان‌های خوانده‌نشده بازیابی شد',
      },
      data,
    }),
    read: (data) => ({
      message: {
        en: 'Notification marked as read',
        fa: 'اعلان به‌عنوان خوانده‌شده علامت خورد',
      },
      data,
    }),
    readAll: (data) => ({
      message: {
        en: 'All notifications marked as read',
        fa: 'همهٔ اعلان‌ها خوانده‌شده شدند',
      },
      data,
    }),
    remove: {
      message: {
        en: 'Notification deleted successfully',
        fa: 'اعلان با موفقیت حذف شد',
      },
    },
  },
};

export const ERROR_MESSAGES = {
  AUTH: {
    invalidCredentials: new BadRequestException({
      message: {
        en: 'Invalid credentials',
        fa: 'اطلاعات ورود نامعتبر است',
      },
    }),
    invalidSessionOrToken: new UnauthorizedException({
      message: {
        en: 'Invalid session or refresh token',
        fa: 'جلسه یا توکن تازه‌سازی نامعتبر است',
      },
    }),
    throttlerException: {
      message: {
        en: 'Too many requests',
        fa: 'درخواست‌های بیش از حد',
      },
    },
    accessDenied: new ForbiddenException({
      message: {
        en: 'Access denied',
        fa: 'دسترسی مجاز نیست',
      },
    }),
    unAuthorized: new UnauthorizedException({
      fa: 'لطفاً وارد شوید',
      en: 'Unauthorized',
    }),
  },
  USERS: {
    emailAlreadyExists: new ConflictException({
      message: {
        en: 'Email already exists',
        fa: 'ایمیل قبلاً استفاده شده است',
      },
    }),
    userNotFound: new NotFoundException({
      message: {
        en: 'User not found',
        fa: 'کاربر یافت نشد',
      },
    }),
    conflictPassword: new ConflictException({
      message: {
        en: 'New password cannot be the same as the current password',
        fa: 'رمز عبور جدید نمی‌تواند با رمز عبور فعلی یکسان باشد',
      },
    }),
    wrongPassword: new BadRequestException({
      message: {
        en: 'password is incorrect',
        fa: 'رمز عبور نادرست است',
      },
    }),
  },
  INTERNAL_ERROR: (error) => {
    throw new InternalServerErrorException(error);
  },
  POSTS: {
    postAlreadyExists: new ConflictException({
      message: {
        en: 'Post already exists',
        fa: 'این پست موجود است',
      },
    }),
    postNotFound: new NotFoundException({
      message: {
        en: 'Post not found',
        fa: 'پست یافت نشد',
      },
    }),
  },
  SOCIAL: {
    cannotFollowSelf: new BadRequestException({
      message: {
        en: 'You cannot follow yourself',
        fa: 'نمی‌توانید خودتان را دنبال کنید',
      },
    }),
  },
  NOTIFICATIONS: {
    notificationNotFound: new NotFoundException({
      message: {
        en: 'Notification not found',
        fa: 'اعلان یافت نشد',
      },
    }),
  },
  COMMENTS: {
    commentNotFound: new NotFoundException({
      message: {
        en: 'Comment not found',
        fa: 'کامنت یافت نشد',
      },
    }),
  },
  CATEGORIES: {
    categoryNotFound: new NotFoundException({
      message: {
        en: 'Category not found',
        fa: 'دسته‌بندی یافت نشد',
      },
    }),
    categoryAlreadyExists: new ConflictException({
      message: {
        en: 'Category already exists',
        fa: 'دسته‌بندی قبلاً ایجاد شده است',
      },
    }),
    categoriesNotFound: new NotFoundException({
      message: {
        en: 'One or more categories not found',
        fa: 'یک یا چند دسته‌بندی یافت نشد',
      },
    }),
  },
};
