import { useState } from "react";
import { useCreateHotelReviewMutation } from "../store/apiSlice";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { SelectOptionLabel } from "./ui/select-option-label";
import { Star } from "lucide-react";
import useAppContext from "../hooks/useAppContext";
import { theme } from "../lib/theme";
import { cn } from "../lib/utils";

type Props = {
  hotelId: string;
  bookingId: string;
  onDone?: () => void;
};

/** Compact JWT review form for a completed booking */
const WriteReviewForm = ({ hotelId, bookingId, onDone }: Props) => {
  const [createReview, { isLoading }] = useCreateHotelReviewMutation();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { showToast } = useAppContext();

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createReview({
        hotelId,
        bookingId,
        rating,
        comment,
        // Same score across categories for a compact guest form
        categories: {
          cleanliness: rating,
          service: rating,
          location: rating,
          value: rating,
          amenities: rating,
        },
      }).unwrap();
      showToast({
        title: "Review submitted",
        description: "Thanks for sharing your stay experience.",
        type: "SUCCESS",
      });
      setOpen(false);
      setComment("");
      onDone?.();
    } catch (error) {
      showToast({
        title: "Could not submit review",
        description: "You may have already reviewed this booking.",
        type: "ERROR",
      });
    }
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Write a review
      </Button>
    );
  }

  return (
    <form
      className={cn(theme.card.base, "mt-3 p-4 bg-gray-50")}
      onSubmit={handleReviewSubmit}
    >
      {/* shadcn Select — matches global control styling (no native <select>) */}
      <div className={theme.form.field}>
        <label className={theme.typography.label}>Rating</label>
        <Select
          value={String(rating)}
          onValueChange={(v) => setRating(Number(v))}
        >
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder="Select rating" />
          </SelectTrigger>
          <SelectContent>
            {[5, 4, 3, 2, 1].map((n) => (
              <SelectItem key={n} value={String(n)}>
                <SelectOptionLabel
                  icon={Star}
                  iconClassName="fill-amber-400 text-amber-500"
                >
                  {n} stars
                </SelectOptionLabel>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={cn(theme.form.field, "mt-3")}>
        <label className={theme.typography.label}>
          Comment
        </label>
        <Textarea
          rows={3}
          required
          minLength={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your stay experience"
          className="bg-white"
        />
      </div>
      <div className="flex gap-2 mt-3">
        <Button type="submit" disabled={isLoading || comment.trim().length < 3}>
          {isLoading ? "Submitting…" : "Submit review"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default WriteReviewForm;
