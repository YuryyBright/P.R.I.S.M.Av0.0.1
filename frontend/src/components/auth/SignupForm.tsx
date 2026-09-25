import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { ArrowRight, Loader2, Mail, User, LockKeyhole } from 'lucide-react';

import AuthService from '../../services/auth.service';
import { ErrorDetail } from '../../services/api';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ApiErrorAlert } from './ApiErrorAlert';
import { PasswordRequirements } from './PasswordRequirements';

import { passwordPolicySchema } from '../../lib/passwordPolicySchema';

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

const signupSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),

    email: z.string().email('Please enter a valid email address'),

    password: passwordPolicySchema,

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function SignupForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'form'>) {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password') ?? '';

  // ───────────────────────────────────────────────────────────
  // Submit
  // ───────────────────────────────────────────────────────────

  const onSubmit = async (data: SignupFormData) => {
    if (isLoading) return;

    setIsLoading(true);
    setApiError(null);
    setFieldErrors({});

    try {
      const nameParts = data.fullName.trim().split(/\s+/);

      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      await AuthService.register({
        email: data.email,
        password: data.password,
        first_name: firstName,
        last_name: lastName,
        full_name: data.fullName,
      });

      navigate('/registration-success');
    } catch (err) {
      const axiosError = err as AxiosError<{
        message?: string;
        errors?: ErrorDetail[];
      }>;

      setApiError(err);

      if (axiosError.response?.data?.errors) {
        const backendFieldErrors: Record<string, string> = {};

        axiosError.response.data.errors.forEach((error) => {
          if (!error.field) return;

          const fieldName =
            error.field === 'full_name' ? 'fullName' : error.field;

          backendFieldErrors[fieldName] = error.message;
        });

        setFieldErrors(backendFieldErrors);
      }

      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────

  const hasFieldError = (field: string) =>
    Boolean(errors[field as keyof typeof errors] || fieldErrors[field]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={`w-full space-y-7 ${className ?? ''}`}
      {...props}
    >
      {/* ───────────────────────────────────────────────────────
          Heading
      ─────────────────────────────────────────────────────── */}

      <div className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          Create your workspace
        </div>

        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Create your account.
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Join P.R.I.S.M.A. and start working with your intelligence
            workspace.
          </p>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────
          API Error
      ─────────────────────────────────────────────────────── */}

      {apiError !== null && !Object.keys(fieldErrors).length && (
        <ApiErrorAlert
          error={apiError}
          fallbackMessage="Registration failed. Please try again."
        />
      )}

      {/* ───────────────────────────────────────────────────────
          Fields
      ─────────────────────────────────────────────────────── */}

      <div className="space-y-5">
        {/* Full name */}
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-xs font-medium">
            Full name
          </Label>

          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              autoComplete="name"
              disabled={isLoading}
              className="h-11 rounded-xl border-border bg-background pl-10 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
              {...register('fullName')}
              aria-invalid={hasFieldError('fullName')}
            />
          </div>

          {errors.fullName && (
            <p className="text-xs text-destructive">
              {errors.fullName.message}
            </p>
          )}

          {fieldErrors.fullName && (
            <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-medium">
            Email address
          </Label>

          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
              className="h-11 rounded-xl border-border bg-background pl-10 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
              {...register('email')}
              aria-invalid={hasFieldError('email')}
            />
          </div>

          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}

          {fieldErrors.email && (
            <p className="text-xs text-destructive">{fieldErrors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-medium">
            Password
          </Label>

          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="password"
              type="password"
              placeholder="Create a secure password"
              autoComplete="new-password"
              disabled={isLoading}
              className="h-11 rounded-xl border-border bg-background pl-10 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
              {...register('password')}
              aria-invalid={hasFieldError('password')}
            />
          </div>

          <PasswordRequirements value={password} />

          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}

          {fieldErrors.password && (
            <p className="text-xs text-destructive">{fieldErrors.password}</p>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-xs font-medium">
            Confirm password
          </Label>

          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              autoComplete="new-password"
              disabled={isLoading}
              className="h-11 rounded-xl border-border bg-background pl-10 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
              {...register('confirmPassword')}
              aria-invalid={Boolean(errors.confirmPassword)}
            />
          </div>

          {errors.confirmPassword && (
            <p className="text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────
          Submit
      ─────────────────────────────────────────────────────── */}

      <Button
        type="submit"
        disabled={isLoading}
        className="group h-11 w-full rounded-xl text-sm font-medium shadow-sm transition-all hover:shadow-md"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Creating account...
          </>
        ) : (
          <>
            Create account
            <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>

      {/* ───────────────────────────────────────────────────────
          Login
      ─────────────────────────────────────────────────────── */}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>

        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-[11px] text-muted-foreground">
            Already have an account?
          </span>
        </div>
      </div>

      <Link
        to="/login"
        className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-medium transition-all hover:bg-muted hover:shadow-sm"
      >
        Sign in
      </Link>

      {/* ───────────────────────────────────────────────────────
          Verification
      ─────────────────────────────────────────────────────── */}

      <p className="text-center text-xs leading-5 text-muted-foreground">
        Need a new verification email?{' '}
        <Link
          to="/resend-verification-email"
          className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
        >
          Resend verification
        </Link>
      </p>
    </form>
  );
}
