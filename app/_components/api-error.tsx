import { alertBox } from "@/app/_components/styles";

export function ApiError({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-light">{title}</h1>
      <p role="alert" className={`mt-6 ${alertBox}`}>
        {message}
      </p>
    </main>
  );
}
