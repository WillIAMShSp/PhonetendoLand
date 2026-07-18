cmake_minimum_required(VERSION 3.12)
cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

project(VigemInputManager VERSION 1.0)
set(CMAKE_CXX_STANDARD 17)


add_definitions(-DNAPI_VERSION=9)
include_directories(${CMAKE_JS_INC} "addons")

file(GLOB SOURCE_FILES "addons/*")

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_JS_INC})
target_link_libraries(${PROJECT_NAME} PRIVATE ${CMAKE_JS_LIB})
target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_17)

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()


add_subdirectory(external/ViGEmClient)

target_link_libraries(${PROJECT_NAME} PRIVATE ViGEmClient)


add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD 
COMMAND ${CMAKE_COMMAND} -E copy 
$<TARGET_FILE:${PROJECT_NAME}>
${CMAKE_SOURCE_DIR}/build/${PROJECT_NAME}.node
)
