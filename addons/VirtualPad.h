/**
 * @file VirtualPad.h
 * @author Luis Camilo Alvarez Carrau
 * @brief Class definition for a virtual game pad.
 * @version 0.1
 * @date 2026-07-18
 */

#pragma once

#define WIN32_LEAN_AND_MEAN  
#include <windows.h>

#include <iostream>
#include <string>
#include <thread>
#include <atomic>
#include <queue>
#include <mutex>
#include <limits>


#include <napi.h>
#include <ViGEm/Client.h>

#pragma comment(lib, "setupapi.lib")

struct ControllerInput {

    USHORT buttonMask;
    bool pressState;

};
struct JoystickAnalog {
    SHORT x = 0;
    SHORT y = 0;
};

struct RumbleContext {
    RumbleContext(Napi::Env env) :deferred(Napi::Promise::Deferred::New(env)) {
        std::cout<< "\nRumble Context Created!\n";
    }

    Napi::Promise::Deferred deferred;
    Napi::ThreadSafeFunction tsfn;
    std::string padSocket;
};



VOID CALLBACK RumbleCallback(PVIGEM_CLIENT Client, PVIGEM_TARGET Target, UCHAR LargeMotor, UCHAR SmallMotor, UCHAR LedNumber, LPVOID UserData) {
    RumbleContext* rumbleContext = (RumbleContext*)UserData;
    
    if (LargeMotor > 0 || SmallMotor > 0) {

        const auto callback = [](Napi::Env env, Napi::Function jsCallback, std::string* socket){
            jsCallback.Call({Napi::String::New(env, socket->c_str())});
        };
    
    
        napi_status status = rumbleContext->tsfn.BlockingCall(&rumbleContext->padSocket,callback);
        if (status != napi_ok) {
            std::cout<< "Failed to make blocking call";
        }


    }
    




}

class VirtualPad : public Napi::ObjectWrap<VirtualPad>
{
public:
    VirtualPad(const Napi::CallbackInfo& info);
    ~VirtualPad();

    Napi::Value test(const Napi::CallbackInfo& info);
    Napi::Value startController(const Napi::CallbackInfo& info);
    Napi::Value sendInput(const Napi::CallbackInfo& info); 
    Napi::Value sendAnalogValue(const Napi::CallbackInfo& info);
    Napi::Value endController(const Napi::CallbackInfo& info);

    static Napi::Function GetClass(Napi::Env env);
    

    std::atomic<bool>& getPadActive();
    std::thread& getPadThread();


private:
    
    std::string playerId;
    std::thread g_controllerInputThread;
    std::atomic<bool> g_padActive;
    std::queue<ControllerInput> g_controllerInputQueue;
    std::mutex g_controllerInputMutex;

    std::thread g_leftAnalogThread;
    std::atomic<JoystickAnalog> g_leftAnalogStick;
    std::mutex g_leftAnalogMutex;

    void injectInput(ControllerInput input); 
    void injectAnalog(JoystickAnalog analog);

    PVIGEM_CLIENT m_client;
    PVIGEM_TARGET m_pad;

    USHORT g_buttonStates = 0;
    void inputPollLoop();


    RumbleContext m_rumbleContext;

    
    
    


};

void throwError(Napi::Env& env, const char* message);

void TestThreaded(std::atomic<bool>& active);

void testEnvs(Napi::Env env);


void finalizeCallBack(Napi::Env env, void* finalizeData, RumbleContext* context);
