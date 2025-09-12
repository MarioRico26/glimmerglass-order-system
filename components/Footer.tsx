// components/Footer.tsx
export default function Footer() {
    return (
      <footer className="w-full py-4 text-center border-t border-slate-200 bg-white">
        <p className="text-sm text-slate-600">
          Powered by{" "}
          <a
            href="https://bytenetworks.net"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sky-700 hover:underline"
          >
            ByteNetworks
          </a>
        </p>
      </footer>
    )
  }