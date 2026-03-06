import ChatBox from "./components/ChatBox";

export default function Home() {
  return (
    <main className="flex h-screen flex-col bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-base font-semibold text-gray-900">SharePoint Assistant</h1>
        <p className="text-sm text-gray-400">Ask anything about the CS library</p>
      </header>
      <ChatBox />
    </main>
  );
}
