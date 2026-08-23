import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <button
        type="button"
        className="flex items-center gap-2 rounded-sm bg-linear-to-b from-lastfm-start to-lastfm-end px-5 py-2.5 font-medium text-whitex transition-[filter] hover:brightness-115 active:translate-y-px"
      >
        <Image
          src="/lastfm-brands-solid-full.svg"
          width={30}
          height={30}
          alt="last.fm logo"
          className="brightness-0 invert"
        />
        log in with last.fm
      </button>
    </main>
  );
}
