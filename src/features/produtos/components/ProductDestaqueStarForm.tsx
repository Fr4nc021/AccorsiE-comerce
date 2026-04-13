import { toggleProductDestaque } from "@/features/produtos/services/toggleProductDestaque";

type ProductDestaqueStarFormProps = {
  productId: string;
  emDestaque: boolean;
};

export function ProductDestaqueStarForm({ productId, emDestaque }: ProductDestaqueStarFormProps) {
  const next = emDestaque ? "0" : "1";
  return (
    <form action={toggleProductDestaque} className="inline-flex justify-center">
      <input type="hidden" name="id" value={productId} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        title={emDestaque ? "Remover dos destaques" : "Marcar como destaque na home"}
        aria-label={emDestaque ? "Remover dos destaques" : "Marcar como destaque na home"}
        aria-pressed={emDestaque}
        className={[
          "rounded-lg p-2 transition",
          emDestaque
            ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600"
            : "text-gray-300 hover:bg-gray-100 hover:text-gray-500",
        ].join(" ")}
      >
        {emDestaque ? <StarFilled /> : <StarOutline />}
      </button>
    </form>
  );
}

function StarFilled() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l7.1-1.01L12 2z"
      />
    </svg>
  );
}

function StarOutline() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l7.1-1.01L12 2z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}
