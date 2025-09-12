// app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                minHeight: '100dvh',
                background:
                    'radial-gradient(1200px 700px at 85% -10%, #E6F7FA 0%, transparent 60%), ' +
                    'radial-gradient(900px 600px at 10% 100%, rgba(0,178,202,.10) 0%, transparent 60%), ' +
                    'linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)',
            }}
            className="relative"
        >
            {children}
        </div>
    )
}