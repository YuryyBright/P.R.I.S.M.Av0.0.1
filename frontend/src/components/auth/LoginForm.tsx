import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loginUser, clearError } from '../../store/slices/authSlice';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { AlertCircle, ArrowRight, Loader2, Mail } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';

import { ErrorResponse } from '@/models/auth';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),

  password: z.string().min(1, 'Password cannot be empty'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'form'>) {
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const from = location.state?.from?.pathname || '/dashboard';

  const onSubmit = async (data: LoginFormData) => {
    if (isLoading) return;

    dispatch(clearError());

    try {
      await dispatch(
        loginUser({
          email: data.email,
          password: data.password,
        })
      ).unwrap();

      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const errorMessage =
    typeof error === 'object' ? (error as ErrorResponse)?.message : error;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={`w-full space-y-7 ${className ?? ''}`}
      {...props}
    >
      {/* Heading */}
      <div className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          Secure authentication
        </div>

        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back.
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to continue to your P.R.I.S.M.A. workspace.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert
          variant="destructive"
          className="border-destructive/20 bg-destructive/5"
        >
          <AlertCircle className="size-4" />

          <AlertDescription>
            {errorMessage || 'Unable to sign in. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Fields */}
      <div className="space-y-5">
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
            />
          </div>

          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-medium">
              Password
            </Label>

            <Link
              to="/request-password-reset"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>

          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={isLoading}
            className="h-11 rounded-xl border-border bg-background shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
            {...register('password')}
          />

          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isLoading}
        className="group h-11 w-full rounded-xl text-sm font-medium shadow-sm transition-all hover:shadow-md"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            Sign in
            <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>

      {/* Register */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>

        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-[11px] text-muted-foreground">
            New to P.R.I.S.M.A.?
          </span>
        </div>
      </div>

      <Link
        to="/register"
        className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-medium transition-all hover:bg-muted hover:shadow-sm"
      >
        Create an account
      </Link>
    </form>
  );
}
