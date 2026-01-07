"use client";

interface GameSystem {
  id: string;
  name: string;
  imageBase64: string | null;
}

interface CampaignHeaderProps {
  title: string;
  campaignImageBase64: string | null;
  gameSystem: GameSystem | null;
}

export function CampaignHeader({
  title,
  campaignImageBase64,
  gameSystem,
}: CampaignHeaderProps) {
  return (
    <div className="relative">
      {campaignImageBase64 ? (
        <div className="aspect-[16/9] max-h-[400px] w-full overflow-hidden">
          <img
            src={campaignImageBase64}
            alt={title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        </div>
      ) : (
        <div className="h-32 bg-gradient-to-br from-blue-600 to-purple-700" />
      )}

      {/* Campaign Title Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-end gap-2">
            {gameSystem?.imageBase64 && !campaignImageBase64 && (
              <img
                src={gameSystem.imageBase64}
                alt={gameSystem.name}
                className="h-16 w-16 rounded-lg border-2 border-white/20 object-cover shadow-lg"
              />
            )}
            <div>
              {gameSystem && (
                <p className="text-sm font-medium text-white/80">
                  {gameSystem.name}
                </p>
              )}
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                {title}
              </h1>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
