// app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative min-h-[100dvh] gg-shell-bg">
            {children}
        </div>
    )
}
