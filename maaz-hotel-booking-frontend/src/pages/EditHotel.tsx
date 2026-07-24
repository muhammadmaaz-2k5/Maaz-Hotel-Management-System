import { useNavigate, useParams } from "react-router-dom";
import ManageHotelForm from "../forms/ManageHotelForm/ManageHotelForm";
import useAppContext from "../hooks/useAppContext";
import { useGetMyHotelByIdQuery, useUpdateMyHotelMutation } from "../store/apiSlice";

const EditHotel = () => {
  const { hotelId } = useParams();
  const { showToast } = useAppContext();
  const navigate = useNavigate();
  const { data: hotel } = useGetMyHotelByIdQuery(hotelId as string, {
    skip: !hotelId,
  });

  const [updateHotel, { isLoading }] = useUpdateMyHotelMutation();

  const handleSave = async (hotelFormData: FormData) => {
    try {
      await updateHotel(hotelFormData).unwrap();
      showToast({
        title: "Hotel Updated Successfully",
        description:
          "Your hotel details have been updated successfully! Redirecting to My Hotels...",
        type: "SUCCESS",
      });
      setTimeout(() => {
        navigate("/my-hotels");
      }, 1500);
    } catch (error: any) {
      showToast({
        title: "Failed to Update Hotel",
        description: error.data?.message || error.message || "There was an error updating your hotel. Please try again.",
        type: "ERROR",
      });
    }
  };

  // Cancel discards edits and returns to My Hotels without saving
  const handleCancel = () => {
    navigate("/my-hotels");
  };

  return (
    <ManageHotelForm
      hotel={hotel}
      onSave={handleSave}
      isLoading={isLoading}
      onCancel={handleCancel}
      showBack
    />
  );
};

export default EditHotel;
