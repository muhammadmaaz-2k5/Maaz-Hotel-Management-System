import { useNavigate } from "react-router-dom";
import ManageHotelForm from "../forms/ManageHotelForm/ManageHotelForm";
import useAppContext from "../hooks/useAppContext";
import { useAddMyHotelMutation } from "../store/apiSlice";

const AddHotel = () => {
  const { showToast } = useAppContext();
  const navigate = useNavigate();
  const [addHotel, { isLoading }] = useAddMyHotelMutation();

  const handleSave = async (hotelFormData: FormData) => {
    try {
      await addHotel(hotelFormData).unwrap();
      showToast({
        title: "Hotel Added Successfully",
        description:
          "Your hotel has been added to the platform successfully! Redirecting to My Hotels...",
        type: "SUCCESS",
      });
      setTimeout(() => {
        navigate("/my-hotels");
      }, 1500);
    } catch (error: any) {
      showToast({
        title: "Failed to Add Hotel",
        description: error.data?.message || error.message || "There was an error saving your hotel. Please try again.",
        type: "ERROR",
      });
    }
  };

  return <ManageHotelForm onSave={handleSave} isLoading={isLoading} showBack />;
};

export default AddHotel;
