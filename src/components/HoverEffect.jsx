import React from 'react';

const HoverEffect = () => {
  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="flex w-3/4 overflow-hidden rounded-lg">
        {/* Image 1 */}
        <div className="relative flex-[1] group hover:flex-[2] transition-all duration-[700ms] ease-in-out">
          <img
            src="https://www.irontribe.com.au/wp-content/uploads/2023/09/Strength-and-Power-in-Weightlifting.jpg" 
            alt="Strength"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center text-white text-xl font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-[700ms] ease-in-out">
            STRENGTH
          </div>
        </div>

        {/* Image 2 */}
        <div className="relative flex-[1] group hover:flex-[2] transition-all duration-[700ms] ease-in-out">
          <img
            src="https://brand.assets.adidas.com/capi/enUS/Images/what-is-mobility-training-blog-image-01_221-976814.jpg"
            alt="Mobility"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center text-white text-xl font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-[700ms] ease-in-out">
            MOBILITY
          </div>
        </div>

        {/* Image 3 */}
        <div className="relative flex-[1] group hover:flex-[2] transition-all duration-[700ms] ease-in-out">
          <img
            src="https://marathonhandbook.com/wp-content/uploads/Running-Drills-1.jpg"
            alt="Drills"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center text-white text-xl font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-[700ms] ease-in-out">
            DRILLS
          </div>
        </div>
      </div>
    </div>
  );
};

export default HoverEffect;
