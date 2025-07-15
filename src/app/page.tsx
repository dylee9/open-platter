import MainDashboard from "@/components/MainDashboard";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12 lg:p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center w-full">
          Open Platter
        </h1>
      </div>

      <MainDashboard />
      
    </main>
  );
} 