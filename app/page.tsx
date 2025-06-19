import Bomb from "./components/bomb";

export default function Home() {
  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: "radial-gradient(ellipse at 12% 30%, #3F141D 0%, #1F0D19 80%)",
      }}
    >
      <h1
        className="text-center text-9xl pt-16 text-white"
      >
        DEFUSE THE BOMB!
      </h1>
      <Bomb />
    </div>
  );
}
