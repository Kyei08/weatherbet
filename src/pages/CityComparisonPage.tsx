import { CityVolatilityComparison } from '@/components/betting/CityVolatilityComparison';
import { useNavigate } from 'react-router-dom';

const CityComparisonPage = () => {
  const navigate = useNavigate();
  
  return <CityVolatilityComparison onBack={() => navigate('/')} />;
};

export default CityComparisonPage;
